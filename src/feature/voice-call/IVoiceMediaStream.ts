export type VoiceAudioFormat = 'g711_ulaw' | 'pcm16'

/**
 * A full-duplex audio stream to the caller, implemented per telephony provider
 * (Twilio, etc.). Audio frames are base64-encoded in {@link VoiceAudioFormat}.
 *
 * Listener registration is additive: each `on*` call adds a listener.
 */
export interface IVoiceMediaStream {
  readonly format: VoiceAudioFormat

  /** Inbound caller audio (base64 frames in `format`). */
  onAudio(listener: (audioBase64: string) => void): void
  /** Caller keypad (DTMF) digits, when the provider surfaces them. */
  onDtmf(listener: (digit: string) => void): void
  /** The call/stream ended (caller hung up or transport closed). */
  onClose(listener: () => void): void

  /** Play audio to the caller (base64 frame in `format`). */
  play(audioBase64: string): void
  /** Flush queued outbound audio — used for barge-in when the caller speaks. */
  clear(): void
  /** End the call. */
  hangup(): void

  /**
   * Resolve once the provider confirms all queued outbound audio has finished
   * playing (or `timeoutMs` elapses / the stream closes). Optional: providers
   * without playback confirmation can omit it, and callers should treat a
   * missing implementation as "nothing to wait for". Used to let the bot's
   * final words finish before hanging up.
   */
  waitForDrain?(timeoutMs?: number): Promise<void>
}
