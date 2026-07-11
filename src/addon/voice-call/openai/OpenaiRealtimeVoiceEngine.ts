import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IToolSchema } from '@/feature/tool'
import {
  IRealtimeFunctionCall,
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  IRealtimeVoiceSessionConfig,
  realtimeVoiceEngine,
  VoiceAudioFormat,
} from '@/feature/voice-call'
import { IRealtimeSocket } from './IRealtimeSocket'
import { openaiRealtimeWsSocket } from './openaiRealtimeWsSocket'

const DEFAULT_MODEL = 'gpt-realtime'
const DEFAULT_VOICE = 'alloy'

/** Maps our codec to the GA Realtime audio format object. */
function audioFormat(format: VoiceAudioFormat) {
  return format === 'pcm16' ? { type: 'audio/pcm', rate: 24000 } : { type: 'audio/pcmu' }
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
      socket.onOpen(() => {
        session.configure()
        this.logger.info('realtime voice session opened')
        resolve()
      })
      socket.onError((error) => reject(error instanceof Error ? error : new Error(String(error))))
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
  private functionCallListener?: (call: IRealtimeFunctionCall) => void
  private closeListener?: () => void
  private errorListener?: (error: unknown) => void

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
            input: { format, turn_detection: { type: 'server_vad' } },
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
      case 'error':
        this.errorListener?.(msg.error ?? msg)
        break
    }
  }
}
