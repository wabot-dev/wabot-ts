import { Logger } from '@/core/logger'
import { IToolSchema } from '@/feature/tool'
import {
  IRealtimeFunctionCall,
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  ITurnDetectionConfig,
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
  /** Tune how long the bot waits for the caller to finish before it replies. */
  turnDetection?: ITurnDetectionConfig
  /** Expose a built-in `end_call` tool so the bot can hang up (default true). */
  endCall?: boolean
}

/** Built-in tool the model can call to hang up gracefully. */
export const END_CALL_TOOL_NAME = 'end_call'

/** Safety cap so a greeting that never reports `response.done` can't hold the
 * caller's mic hostage — after this the session resumes full duplex. */
const GREETING_GUARD_TIMEOUT_MS = 15000

/** Safety cap on waiting for the goodbye to finish generating before hangup, so
 * a missing `response.done` can't leave the call open indefinitely. */
const HANGUP_RESPONSE_TIMEOUT_MS = 5000

const END_CALL_TOOL: IToolSchema = {
  language: 'english',
  name: END_CALL_TOOL_NAME,
  description: 'End the phone call. Only call this after you have said goodbye.',
  parameters: [],
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
  /** While true, the bot is delivering its opening greeting: the caller's audio
   * is held back and barge-in is suppressed so line echo/noise can't clip it. */
  private greetingActive = false
  private greetingTimer?: ReturnType<typeof setTimeout>
  /** One-shot callbacks released on the next `response.done` — lets the hangup
   * flow wait for the goodbye to finish generating before draining playback. */
  private responseDoneWaiters: (() => void)[] = []

  private constructor(
    private media: IVoiceMediaStream,
    private engineSession: IRealtimeVoiceEngineSession,
    private options: IRealtimeVoiceSessionOptions,
  ) {}

  static async start(options: IRealtimeVoiceSessionOptions): Promise<RealtimeVoiceSession> {
    const engineSession = await options.engine.open({
      instructions: options.instructions,
      tools: withEndCallTool(options.tools ?? [], options.endCall !== false),
      audioFormat: options.media.format,
      voice: options.voice,
      provider: options.provider,
      turnDetection: options.turnDetection,
    })

    const session = new RealtimeVoiceSession(options.media, engineSession, options)
    // Open the greeting window before wiring so any caller audio already
    // buffered at connect is held back rather than flushed into the model.
    if (options.greeting) session.beginGreeting()
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

    this.media.onAudio((audio) => {
      // Hold the caller's mic while the greeting plays — feeding it in would let
      // line echo/noise trip server VAD and clip the greeting.
      if (this.greetingActive) return
      engine.appendAudio(audio)
    })
    this.media.onDtmf((digit) => {
      this.logger.debug('caller dtmf', { digit })
      // Surface keypad input to the model so it can react (IVR-style flows).
      engine.sendUserText(`The caller pressed the keypad digit "${digit}".`)
    })
    this.media.onClose(() => this.close('caller-hangup'))

    engine.onAudio((audio) => this.media.play(audio))
    // Barge-in: the caller started talking. Drop bot audio still queued on the
    // wire AND cancel the model's in-progress response so it stops generating.
    // Suppressed during the greeting so it can't be interrupted by echo/noise.
    engine.onSpeechStarted(() => {
      if (this.greetingActive) return
      this.media.clear()
      engine.cancelResponse()
    })
    // The greeting turn is over once its response finishes generating AND has
    // finished playing to the caller — resuming before playback drains would let
    // echo of the tail trip barge-in and clip it. Fall back to the guard timeout.
    engine.onResponseDone?.(() => {
      // Release anyone waiting for the model to finish generating (e.g. the
      // hangup flow, which drains playback only once the goodbye is complete).
      const waiters = this.responseDoneWaiters
      this.responseDoneWaiters = []
      for (const waiter of waiters) waiter()

      if (!this.greetingActive) return
      void Promise.resolve(this.media.waitForDrain?.(GREETING_GUARD_TIMEOUT_MS)).then(() =>
        this.endGreeting(),
      )
    })
    engine.onFunctionCall((call) => void this.handleFunctionCall(call))
    engine.onError((error) => {
      // A cancel that races a response finishing (barge-in fired just as the
      // response completed) is benign — the response is already gone. Log it at
      // debug so it doesn't read as a real failure.
      if (isBenignCancelRace(error)) {
        this.logger.debug('realtime cancel raced response completion')
        return
      }
      this.logger.error(
        'realtime engine error',
        error instanceof Error ? { message: error.message } : { error },
      )
    })
    engine.onClose(() => this.close('engine-closed'))
  }

  /** Start the opening-greeting window (mic held, barge-in suppressed). */
  private beginGreeting() {
    this.greetingActive = true
    this.greetingTimer = setTimeout(() => this.endGreeting(), GREETING_GUARD_TIMEOUT_MS)
    // Don't let the safety timer keep the process alive on its own.
    this.greetingTimer.unref?.()
  }

  /** End the greeting window and resume full-duplex audio + barge-in. */
  private endGreeting() {
    if (!this.greetingActive) return
    this.greetingActive = false
    if (this.greetingTimer) clearTimeout(this.greetingTimer)
    this.greetingTimer = undefined
  }

  /** Resolve once the model reports the current response finished generating,
   * or after a guard timeout so a missing `response.done` can't strand hangup.
   * Resolves immediately when the engine can't report response completion. */
  private waitForResponseDone(): Promise<void> {
    if (!this.engineSession.onResponseDone) return Promise.resolve()
    return new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, HANGUP_RESPONSE_TIMEOUT_MS)
      timer.unref?.()
      this.responseDoneWaiters.push(done)
    })
  }

  private async handleFunctionCall(call: IRealtimeFunctionCall) {
    if (call.name === END_CALL_TOOL_NAME) {
      this.engineSession.submitToolResult(call.callId, 'Call ended.')
      // Wait for the goodbye to finish *generating* before we drain and hang up.
      // end_call can fire while the model is still streaming the goodbye audio;
      // draining then would only flush the part queued so far and clip the last
      // words. `response.done` means the goodbye is fully queued to Twilio, so
      // the drain that follows can wait for it to actually play out.
      await this.waitForResponseDone()
      await this.media.waitForDrain?.()
      this.close('bot-ended')
      return
    }

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
    this.endGreeting()
    // Release anyone still awaiting response completion so their wait unwinds
    // instead of dangling until the guard timeout (e.g. caller hangs up first).
    const waiters = this.responseDoneWaiters
    this.responseDoneWaiters = []
    for (const waiter of waiters) waiter()
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

/** True for the API's "no active response to cancel" error, which barge-in can
 * provoke by racing a response that finished a beat earlier. */
function isBenignCancelRace(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'response_cancel_not_active'
  )
}

function withEndCallTool(tools: IToolSchema[], enabled: boolean): IToolSchema[] {
  if (!enabled) return tools
  if (tools.some((tool) => tool.name === END_CALL_TOOL_NAME)) return tools
  return [...tools, END_CALL_TOOL]
}
