import { injectable } from '@/core/injection'

/**
 * Configuration for the Twilio voice channel.
 *
 * `publicBaseUrl` is the externally reachable origin Twilio uses to reach this
 * server (e.g. an ngrok URL in dev, your domain in prod). It is used to build
 * both the webhook and the media `wss://` URL.
 */
@injectable()
export class TwilioVoiceConfig {
  constructor(
    public publicBaseUrl: string,
    public accountSid: string = process.env.TWILIO_ACCOUNT_SID ?? '',
    public authToken: string = process.env.TWILIO_AUTH_TOKEN ?? '',
    public fromNumber: string = process.env.TWILIO_NUMBER ?? '',
    public webhookPath: string = '/voice/twilio/incoming',
    public mediaPath: string = '/voice/twilio/media',
    public voice: string = 'alloy',
    public language: string = 'es-CO',
  ) {}

  /** wss:// URL for the bidirectional Media Stream. */
  mediaStreamUrl(): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '').replace(/^http/, 'ws')
    return `${base}${this.mediaPath}`
  }
}
