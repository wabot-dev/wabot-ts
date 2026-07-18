import { IToolSchema } from '@/feature/tool'
import { VoiceAudioFormat } from './IVoiceMediaStream'

export interface IRealtimeFunctionCall {
  callId: string
  name: string
  arguments: string
}

/**
 * Server-VAD turn-detection tuning. Controls when the provider decides the
 * caller has finished speaking and lets the bot take its turn.
 */
export interface ITurnDetectionConfig {
  /**
   * Silence (ms) after the caller stops before their turn is considered over.
   * Raise it so the bot waits longer — and interrupts less — when the caller
   * pauses mid-thought. Lower it for snappier, more eager replies.
   */
  silenceMs?: number
  /** VAD activation threshold 0..1; higher ignores quieter speech and noise. */
  threshold?: number
  /** Audio (ms) kept before detected speech so word onsets aren't clipped. */
  prefixPaddingMs?: number
}

export interface IRealtimeVoiceSessionConfig {
  /** System instructions (the Mindset system prompt). */
  instructions: string
  /** Tools exposed to the model, mapped to provider function-calling. */
  tools: IToolSchema[]
  /** Audio codec used on the wire; matches the media stream. */
  audioFormat: VoiceAudioFormat
  /** Provider voice id (e.g. 'alloy'). */
  voice?: string
  /** Selects the registered engine; defaults to the first registered. */
  provider?: string
  /** How long to wait for the caller to finish before the bot replies. */
  turnDetection?: ITurnDetectionConfig
}

/** A live connection to the realtime speech model for one call. */
export interface IRealtimeVoiceEngineSession {
  /** Push caller audio into the model (base64, matching `audioFormat`). */
  appendAudio(audioBase64: string): void
  /** Return the result of a function/tool call to the model. */
  submitToolResult(callId: string, output: string): void
  /** Ask the model to produce a response now (greeting, or after a tool result). */
  createResponse(instructions?: string): void
  /** Cancel the model's in-progress response (used for barge-in). */
  cancelResponse(): void
  /** Inject a user turn and request a response (e.g. DTMF or a system note). */
  sendUserText(text: string): void
  /** Close the model connection. */
  close(): void

  /** Model speech to play back to the caller (base64 in `audioFormat`). */
  onAudio(listener: (audioBase64: string) => void): void
  /** The model detected the caller started speaking (drive barge-in). */
  onSpeechStarted(listener: () => void): void
  /**
   * A model response finished (completed, cancelled or failed). Optional —
   * used to know when the opening greeting turn is over. Providers that can't
   * surface it may omit it.
   */
  onResponseDone?(listener: () => void): void
  /** The model wants to call a tool. */
  onFunctionCall(listener: (call: IRealtimeFunctionCall) => void): void
  onClose(listener: () => void): void
  onError(listener: (error: unknown) => void): void
}

export interface IRealtimeVoiceEngine {
  open(config: IRealtimeVoiceSessionConfig): Promise<IRealtimeVoiceEngineSession>
}
