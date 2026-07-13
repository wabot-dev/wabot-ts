export type VoiceCallDirection = 'inbound' | 'outbound'

/** Identity/metadata of a single voice call. */
export interface IVoiceCallConnection {
  /** Provider-side call id (e.g. Twilio CallSid). */
  callId: string
  /** Caller number in E.164 (e.g. +57...). */
  from: string
  /** Callee number in E.164. */
  to: string
  direction: VoiceCallDirection
  channelName: string
}
