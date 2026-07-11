import { Logger } from '@/core/logger'
import { IToolSchema } from '@/feature/tool'
import {
  IRealtimeFunctionCall,
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
} from './IRealtimeVoiceEngine'
import { IVoiceCallConnection } from './IVoiceCallConnection'
import { IVoiceMediaStream } from './IVoiceMediaStream'

export interface IRealtimeVoiceSessionOptions {
  media: IVoiceMediaStream
  engine: IRealtimeVoiceEngine
  connection: IVoiceCallConnection
  /** System instructions (typically the Mindset system prompt). */
  instructions: string
  tools?: IToolSchema[]
  /** Runs a tool the model invoked; returns the result string for the model. */
  callFunction?: (name: string, args: string) => Promise<string>
  voice?: string
  /** If set, the bot speaks first with this instruction when the call connects. */
  greeting?: string
  provider?: string
}

/**
 * Bridges a telephony media stream to a realtime speech engine: pumps audio
 * both ways, drives barge-in (caller speech flushes queued bot audio), and
 * routes the model's tool calls to `callFunction`. Provider-agnostic — the
 * transport and engine are injected.
 */
export class RealtimeVoiceSession {
  private logger = new Logger('wabot:realtime-voice-session')
  private closed = false

  private constructor(
    private media: IVoiceMediaStream,
    private engineSession: IRealtimeVoiceEngineSession,
    private options: IRealtimeVoiceSessionOptions,
  ) {}

  static async start(options: IRealtimeVoiceSessionOptions): Promise<RealtimeVoiceSession> {
    const engineSession = await options.engine.open({
      instructions: options.instructions,
      tools: options.tools ?? [],
      audioFormat: options.media.format,
      voice: options.voice,
      provider: options.provider,
    })

    const session = new RealtimeVoiceSession(options.media, engineSession, options)
    session.wire()

    if (options.greeting) {
      engineSession.createResponse(options.greeting)
    }

    session.logger.info('voice session started', {
      callId: options.connection.callId,
      direction: options.connection.direction,
    })
    return session
  }

  private wire() {
    const engine = this.engineSession

    this.media.onAudio((audio) => engine.appendAudio(audio))
    this.media.onDtmf((digit) => this.logger.debug('caller dtmf', { digit }))
    this.media.onClose(() => this.close('caller-hangup'))

    engine.onAudio((audio) => this.media.play(audio))
    // Barge-in: the caller started talking, so drop any bot audio still queued.
    engine.onSpeechStarted(() => this.media.clear())
    engine.onFunctionCall((call) => void this.handleFunctionCall(call))
    engine.onError((error) =>
      this.logger.error(
        'realtime engine error',
        error instanceof Error ? { message: error.message } : { error },
      ),
    )
    engine.onClose(() => this.close('engine-closed'))
  }

  private async handleFunctionCall(call: IRealtimeFunctionCall) {
    const { callFunction } = this.options
    if (!callFunction) {
      this.engineSession.submitToolResult(call.callId, 'No tool handler is configured')
      this.engineSession.createResponse()
      return
    }
    try {
      const result = await callFunction(call.name, call.arguments || '{}')
      this.engineSession.submitToolResult(call.callId, result)
    } catch (error) {
      this.logger.error(
        `tool '${call.name}' failed`,
        error instanceof Error ? { message: error.message } : { error },
      )
      this.engineSession.submitToolResult(
        call.callId,
        `Error: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
    this.engineSession.createResponse()
  }

  /** Ends the call and tears down both the engine and the media stream. */
  close(reason?: string) {
    if (this.closed) return
    this.closed = true
    this.logger.info('voice session closed', {
      reason,
      callId: this.options.connection.callId,
    })
    try {
      this.engineSession.close()
    } catch (error) {
      this.logger.warn('error closing engine session', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
    try {
      this.media.hangup()
    } catch (error) {
      this.logger.warn('error hanging up media', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
