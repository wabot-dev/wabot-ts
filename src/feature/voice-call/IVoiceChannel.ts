import { IIncomingVoiceCall } from './IIncomingVoiceCall'

/**
 * A voice transport (Twilio, etc.), analogous to IChatChannel. It surfaces
 * incoming calls; a voice controller decides which VoiceBot answers each one.
 */
export interface IVoiceChannel {
  listen(callback: (call: IIncomingVoiceCall) => Promise<void>): void
  connect(): void
  disconnect(): void
}
