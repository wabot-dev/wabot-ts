/**
 * A Twilio account and the caller-ID numbers it may place outbound calls from.
 * Register several to dial from multiple numbers and/or multiple accounts —
 * each outbound call uses the credentials of the account that owns its `from`.
 */
export interface ITwilioAccount {
  /** Twilio Account SID (starts with `AC`). */
  accountSid: string
  /** Twilio Auth Token for this account. */
  authToken: string
  /** E.164 numbers this account can dial from. The first is its default. */
  numbers: string[]
}
