import { injectable } from '@/core/injection'
import { normalizeE164 } from './phoneNumber'

export interface ITwilioVoiceConfigOptions {
  publicBaseUrl?: string
  accountSid?: string
  authToken?: string
  fromNumber?: string
  webhookPath?: string
  mediaPath?: string
  voice?: string
  language?: string
  /** Verify Twilio's `X-Twilio-Signature` on inbound webhooks for this channel. */
  verifySignature?: boolean
  /**
   * Caller-ID numbers Twilio routes to this channel's webhook. Used to pick this
   * channel's config for outbound calls: `TwilioCalls.initiate({ from })` dials
   * through the channel whose `numbers` include `from`, so the call is answered
   * by the same flow that answers inbound calls to that number.
   */
  numbers?: string[]
}

/**
 * Configuration for a Twilio voice channel.
 *
 * `publicBaseUrl` is the externally reachable origin Twilio uses to reach this
 * server (e.g. an ngrok URL in dev, your domain in prod). It is used to build
 * both the webhook and the media `wss://` URL.
 *
 * Each `@twilioVoice` decorator builds its own instance, so different channels
 * can use different `webhookPath`/`mediaPath` routes and their own signature
 * settings. Unset values fall back to environment variables / defaults.
 */
@injectable()
export class TwilioVoiceConfig {
  publicBaseUrl: string
  accountSid: string
  authToken: string
  fromNumber: string
  webhookPath: string
  mediaPath: string
  voice: string
  language: string
  verifySignature: boolean
  numbers: string[]

  constructor(options: ITwilioVoiceConfigOptions = {}) {
    this.publicBaseUrl = options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? ''
    this.accountSid = options.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? ''
    this.authToken = options.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? ''
    this.fromNumber = options.fromNumber ?? process.env.TWILIO_NUMBER ?? ''
    this.webhookPath = options.webhookPath ?? '/voice/twilio/incoming'
    this.mediaPath = options.mediaPath ?? '/voice/twilio/media'
    this.voice = options.voice ?? 'alloy'
    this.language = options.language ?? 'es-CO'
    this.verifySignature = options.verifySignature ?? false
    this.numbers = options.numbers?.map(normalizeE164).filter((n) => n.length > 0) ?? []
  }

  /** wss:// URL for the bidirectional Media Stream. */
  mediaStreamUrl(): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '').replace(/^http/, 'ws')
    return `${base}${this.mediaPath}`
  }
}
