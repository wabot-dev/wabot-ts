import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IToolSchema } from '@/feature/tool'
import {
  IRealtimeFunctionCall,
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  IRealtimeVoiceSessionConfig,
  ITurnDetectionConfig,
  realtimeVoiceEngine,
  VoiceAudioFormat,
} from '@/feature/voice-call'
import { IRealtimeSocket } from './IRealtimeSocket'
import { openaiRealtimeWsSocket } from './openaiRealtimeWsSocket'

const DEFAULT_MODEL = 'gpt-realtime'
const DEFAULT_VOICE = 'alloy'
/** Fallback so a missing `session.updated` ack can never hang the call. */
const SESSION_READY_TIMEOUT_MS = 2000
/**
 * End-of-turn silence default. OpenAI's own default is 500 ms, which is snappy
 * but makes the bot cut in the moment the caller pauses mid-sentence on a phone
 * line. 700 ms leaves room to breathe without feeling sluggish; per-call config
 * can raise or lower it.
 */
const DEFAULT_SILENCE_DURATION_MS = 700

/** Maps our codec to the GA Realtime audio format object. */
function audioFormat(format: VoiceAudioFormat) {
  return format === 'pcm16' ? { type: 'audio/pcm', rate: 24000 } : { type: 'audio/pcmu' }
}

/** Builds the server-VAD `turn_detection` object from our tuning config. */
function turnDetection(config?: ITurnDetectionConfig) {
  const detection: Record<string, unknown> = {
    type: 'server_vad',
    silence_duration_ms: config?.silenceMs ?? DEFAULT_SILENCE_DURATION_MS,
  }
  if (config?.threshold !== undefined) detection.threshold = config.threshold
  if (config?.prefixPaddingMs !== undefined) detection.prefix_padding_ms = config.prefixPaddingMs
  return detection
}

/** True when a raw message is OpenAI's ack that our `session.update` applied. */
function isSessionUpdated(raw: string): boolean {
  try {
    return (JSON.parse(raw) as { type?: string }).type === 'session.updated'
  } catch {
    return false
  }
}

function mapTool(tool: IToolSchema) {
  const properties: Record<string, unknown> = {}
  for (const param of tool.parameters) properties[param.name] = param.schema
  return {
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      required: tool.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }
}

@realtimeVoiceEngine({ provider: 'openai' })
@singleton()
export class OpenaiRealtimeVoiceEngine implements IRealtimeVoiceEngine {
  private logger = new Logger('wabot:openai-realtime-voice-engine')

  async open(config: IRealtimeVoiceSessionConfig): Promise<IRealtimeVoiceEngineSession> {
    const socket = this.createSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config)

    await new Promise<void>((resolve, reject) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      // Only report the session ready once OpenAI has applied our config
      // (`session.updated`) — creating the greeting response before then makes
      // it render with the default voice instead of the configured one. A short
      // timeout is the safety net so a missing ack can't strand the call.
      const ready = () => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        this.logger.info('realtime voice session opened')
        resolve()
      }
      socket.onMessage((raw) => {
        if (isSessionUpdated(raw)) ready()
      })
      socket.onOpen(() => {
        session.configure()
        timer = setTimeout(ready, SESSION_READY_TIMEOUT_MS)
      })
      socket.onError((error) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })

    return session
  }

  /** Overridable in tests to inject a fake socket. */
  protected createSocket(): IRealtimeSocket {
    const model = process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_MODEL
    const apiKey = process.env.OPENAI_API_KEY ?? ''
    return openaiRealtimeWsSocket({
      url: `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
      // GA Realtime API: no OpenAI-Beta header (the beta shape is disabled).
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  }
}

export class OpenaiRealtimeVoiceEngineSession implements IRealtimeVoiceEngineSession {
  private audioListener?: (audioBase64: string) => void
  private speechStartedListener?: () => void
  private responseDoneListener?: () => void
  private functionCallListener?: (call: IRealtimeFunctionCall) => void
  private closeListener?: () => void
  private errorListener?: (error: unknown) => void
  /** True while the model is generating a response. Used to avoid sending a
   * `response.cancel` (barge-in) when there is nothing to cancel, which the API
   * rejects with `response_cancel_not_active`. */
  private responseActive = false

  constructor(
    private socket: IRealtimeSocket,
    private config: IRealtimeVoiceSessionConfig,
  ) {
    this.socket.onMessage((data) => this.handleMessage(data))
    this.socket.onClose(() => this.closeListener?.())
    this.socket.onError((error) => this.errorListener?.(error))
  }

  /** Sends the initial session configuration (called once the socket is open). */
  configure() {
    const format = audioFormat(this.config.audioFormat)
    this.socket.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: this.config.instructions,
          output_modalities: ['audio'],
          audio: {
            input: { format, turn_detection: turnDetection(this.config.turnDetection) },
            output: { format, voice: this.config.voice ?? DEFAULT_VOICE },
          },
          tools: this.config.tools.map(mapTool),
          tool_choice: this.config.tools.length > 0 ? 'auto' : 'none',
        },
      }),
    )
  }

  appendAudio(audioBase64: string) {
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: audioBase64 }))
  }

  submitToolResult(callId: string, output: string) {
    this.socket.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output },
      }),
    )
  }

  createResponse(instructions?: string) {
    this.socket.send(
      JSON.stringify({ type: 'response.create', response: instructions ? { instructions } : {} }),
    )
  }

  cancelResponse() {
    // No response in flight — nothing to cancel. Skip the send so the API
    // doesn't reject it with `response_cancel_not_active`.
    if (!this.responseActive) return
    this.responseActive = false
    this.socket.send(JSON.stringify({ type: 'response.cancel' }))
  }

  sendUserText(text: string) {
    this.socket.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
      }),
    )
    this.createResponse()
  }

  close() {
    this.socket.close()
  }

  onAudio(listener: (audioBase64: string) => void) {
    this.audioListener = listener
  }
  onSpeechStarted(listener: () => void) {
    this.speechStartedListener = listener
  }
  onResponseDone(listener: () => void) {
    this.responseDoneListener = listener
  }
  onFunctionCall(listener: (call: IRealtimeFunctionCall) => void) {
    this.functionCallListener = listener
  }
  onClose(listener: () => void) {
    this.closeListener = listener
  }
  onError(listener: (error: unknown) => void) {
    this.errorListener = listener
  }

  private handleMessage(raw: string) {
    let msg: Record<string, any>
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    switch (msg.type) {
      case 'input_audio_buffer.speech_started':
        this.speechStartedListener?.()
        break
      // A response is now generating — barge-in may cancel it from here on.
      case 'response.created':
        this.responseActive = true
        break
      // Audio chunk event name varies across API versions; handle both.
      case 'response.audio.delta':
      case 'response.output_audio.delta':
        if (typeof msg.delta === 'string') this.audioListener?.(msg.delta)
        break
      case 'response.function_call_arguments.done':
        this.functionCallListener?.({
          callId: msg.call_id,
          name: msg.name,
          arguments: typeof msg.arguments === 'string' ? msg.arguments : '',
        })
        break
      // Fires for every finished response (completed/cancelled/failed) — used to
      // close the opening-greeting window so normal barge-in can resume.
      case 'response.done':
        this.responseActive = false
        this.responseDoneListener?.()
        break
      case 'error':
        this.errorListener?.(msg.error ?? msg)
        break
    }
  }
}
