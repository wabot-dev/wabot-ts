import { IVoiceCallConnection } from './IVoiceCallConnection'
import { IVoiceMediaStream } from './IVoiceMediaStream'

/** A call handed to a voice controller: who's calling + the live audio stream. */
export interface IVoiceCall {
  connection: IVoiceCallConnection
  media: IVoiceMediaStream
  /** Suggested opening line (e.g. from an outbound `initiate` intent). */
  greeting?: string
}

/** What a voice channel emits when a call connects (adds per-call DI overrides). */
export interface IIncomingVoiceCall extends IVoiceCall {
  injectInstances?: [unknown, unknown][]
}
