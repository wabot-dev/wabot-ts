import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { Logger } from '@/core/logger'
import { IMindset } from '@/feature/mindset'
import { OutboundCallIntents, VoiceBotRegistry } from '@/feature/voice-call'
import { TwilioAccountRegistry } from './TwilioAccountRegistry'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'
import { normalizeE164, toE164Colombia } from './phoneNumber'

export interface IInitiateCallRequest {
  /** Recipient number; normalized to +57 E.164 when no country code is given. */
  to: string
  /**
   * Caller-ID number to dial from. Must belong to a registered account (see
   * TwilioAccountRegistry); its account's credentials are used. Defaults to the
   * first registered number.
   */
  from?: string
  /** Bot to answer with: a name, a Mindset class, or omitted for the default. */
  bot?: string | IConstructor<IMindset>
  /** Opening-line instruction for this call. */
  greeting?: string
  voice?: string
}

export interface IInitiateCallResult {
  callId: string
  to: string
}

/**
 * Places outbound calls via the Twilio REST API. On answer Twilio fetches the
 * same webhook as inbound, so the call runs through the media bridge.
 *
 * This just dials. Consent / who-may-be-called is the application's policy —
 * gate it before calling `initiate` (e.g. check your own consent store).
 *
 * Multiple numbers / accounts: pass `from` to dial from a specific number;
 * the owning account's credentials (from TwilioAccountRegistry) are used.
 */
@singleton()
export class TwilioCallService {
  private logger = new Logger('wabot:twilio-call-service')

  constructor(
    private config: TwilioVoiceConfig,
    private bots: VoiceBotRegistry,
    private intents: OutboundCallIntents,
    private accounts: TwilioAccountRegistry,
  ) {}

  async initiate(req: IInitiateCallRequest): Promise<IInitiateCallResult> {
    const to = toE164Colombia(req.to)

    const from = req.from ? normalizeE164(req.from) : this.accounts.defaultNumber()
    if (!from) {
      throw new Error(
        'No Twilio caller-ID configured: set TWILIO_NUMBER or register an account ' +
          'via TwilioAccountRegistry.',
      )
    }
    const account = this.accounts.accountForNumber(from)
    if (!account) {
      throw new Error(
        `No Twilio account registered for from-number ${from}. ` +
          'Register it via TwilioAccountRegistry.register(...).',
      )
    }

    const botName = this.resolveBotName(req.bot)
    const intentId = this.intents.create({ bot: botName, greeting: req.greeting, voice: req.voice })
    const url = this.buildWebhookUrl(intentId)

    const { sid } = await this.createCall({
      to,
      from,
      url,
      accountSid: account.accountSid,
      authToken: account.authToken,
    })
    this.logger.info('outbound call initiated', { to, from, callId: sid, bot: botName })
    return { callId: sid, to }
  }

  private resolveBotName(bot?: string | IConstructor<IMindset>): string | undefined {
    if (typeof bot === 'string') return bot
    if (bot) {
      this.bots.register({ name: bot.name, mindset: bot })
      return bot.name
    }
    // No explicit bot: the answering voice controller decides which bot handles
    // the call, so the intent carries only the greeting.
    return this.bots.defaultBotName()
  }

  private buildWebhookUrl(intentId: string): string {
    const base = this.config.publicBaseUrl.replace(/\/+$/, '')
    return `${base}${this.config.webhookPath}?intent=${encodeURIComponent(intentId)}`
  }

  /** Overridable in tests. Calls Twilio's REST API directly (no SDK dependency). */
  protected async createCall(params: {
    to: string
    from: string
    url: string
    accountSid: string
    authToken: string
  }): Promise<{ sid: string }> {
    const body = new URLSearchParams({ To: params.to, From: params.from, Url: params.url })
    const auth = Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64')
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Twilio call create failed: ${res.status} ${res.statusText} ${detail}`.trim())
    }
    const json = (await res.json()) as { sid: string }
    return { sid: json.sid }
  }
}
