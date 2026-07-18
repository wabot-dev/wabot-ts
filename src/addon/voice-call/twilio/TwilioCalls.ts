import { container, singleton } from '@/core/injection'
import { VoiceControllerMetadataStore } from '@/feature/voice-call'
import { IInitiateCallRequest, IInitiateCallResult, TwilioCallService } from './TwilioCallService'
import { TwilioVoiceChannel } from './TwilioVoiceChannel'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'
import { normalizeE164 } from './phoneNumber'

/**
 * Places outbound calls from code that is not a voice channel: a
 * `@commandHandler`, a REST controller, a cron job, a service.
 *
 * A `@twilioVoice` channel builds its own {@link TwilioVoiceConfig} (its
 * `webhookPath`, `publicBaseUrl`, …). An outbound call must dial that *same*
 * config, or Twilio fetches a route that does not exist and the caller hears
 * silence — so the channel is selected by the `from` caller-ID: the call dials
 * through the channel whose `numbers` include `from`, and is answered by the same
 * flow that answers inbound calls to that number.
 *
 * ```ts
 * import { TwilioCalls } from '@wabot-dev/framework'
 *
 * await TwilioCalls.initiate({ to, from: '+576011110000', greeting: '…' })
 * ```
 *
 * With a single `@twilioVoice` channel (the common case) `from` is optional and
 * selects only the account credentials; the lone channel answers. With several,
 * `from` must be a number one of them declares — an unresolved call throws
 * rather than dialing the wrong flow. No controller reference, so app code never
 * imports a voice controller (which would risk a dependency cycle).
 */
@singleton()
export class TwilioCalls {
  private services = new Map<TwilioVoiceConfig, TwilioCallService>()

  constructor(private store: VoiceControllerMetadataStore) {}

  /**
   * Place an outbound call without touching the DI container — the entry point
   * for app code. Resolves the shared `TwilioCalls` and delegates.
   *
   * ```ts
   * await TwilioCalls.initiate({ to, from: '+576011110000', greeting })
   * ```
   *
   * Code that is itself DI-constructed (e.g. a mindset tool) should inject
   * `TwilioCalls` and call the instance method, so it stays testable with a fake.
   */
  static initiate(req: IInitiateCallRequest): Promise<IInitiateCallResult> {
    return container.resolve(TwilioCalls).initiate(req)
  }

  /**
   * Place an outbound call. The `@twilioVoice` channel is chosen by `req.from`
   * (see the class docs); credentials are then resolved from the account that
   * owns `from` (TwilioAccountRegistry), inside {@link TwilioCallService}.
   */
  async initiate(req: IInitiateCallRequest): Promise<IInitiateCallResult> {
    // async so a channel-selection error surfaces as a rejection, not a
    // synchronous throw from a method the caller awaits.
    return this.serviceFor(this.configForFrom(req.from)).initiate(req)
  }

  /**
   * The config a bare outbound resolve uses when no `from` narrows it down.
   * Exposed so the root container can answer a `TwilioVoiceConfig` injection.
   */
  defaultConfig(): TwilioVoiceConfig {
    const configs = this.twilioConfigs()
    if (configs.length === 0) return new TwilioVoiceConfig() // outbound-only: env defaults
    if (configs.length === 1) return configs[0]!
    throw new Error(
      'Several @twilioVoice channels are declared, so a bare TwilioVoiceConfig is ' +
        'ambiguous. Place outbound calls via TwilioCalls.initiate({ from }) rather ' +
        `than resolving TwilioCallService directly. Declared: ${this.describe(configs)}.`,
    )
  }

  /** The channel config whose `numbers` own `from` (see the class docs). */
  private configForFrom(from?: string): TwilioVoiceConfig {
    const configs = this.twilioConfigs()

    // No channel declared: an outbound-only app. The config reads the same
    // environment variables the decorator would have, so this is meaningful.
    if (configs.length === 0) return new TwilioVoiceConfig()

    if (from) {
      const target = normalizeE164(from)
      const match = configs.find((config) => config.numbers.includes(target))
      if (match) return match
    }

    // A single channel always wins — `from` only had to pick credentials.
    if (configs.length === 1) return configs[0]!

    throw new Error(
      from
        ? `No @twilioVoice channel serves the caller-ID ${normalizeE164(from)}. ` +
          `Declare it with @twilioVoice({ numbers: ['${normalizeE164(from)}'] }). ` +
          `Declared: ${this.describe(configs)}.`
        : 'Several @twilioVoice channels are declared; pass a `from` number that ' +
          `one of them declares. Declared: ${this.describe(configs)}.`,
    )
  }

  private twilioConfigs(): TwilioVoiceConfig[] {
    const configs: TwilioVoiceConfig[] = []
    for (const controller of this.store.getAllVoiceControllerConstructors()) {
      const metadata = this.store.getVoiceControllerMetadata(controller)
      for (const channel of metadata?.channels ?? []) {
        if (channel.channelConstructor !== TwilioVoiceChannel) continue
        if (channel.channelConfig instanceof TwilioVoiceConfig) configs.push(channel.channelConfig)
      }
    }
    return configs
  }

  private describe(configs: TwilioVoiceConfig[]): string {
    if (configs.length === 0) return 'none'
    return configs
      .map((c) => `${c.webhookPath} [${c.numbers.join(', ') || 'no numbers'}]`)
      .join(', ')
  }

  /** One service per config, so callers get a stable instance per channel. */
  private serviceFor(config: TwilioVoiceConfig): TwilioCallService {
    const cached = this.services.get(config)
    if (cached) return cached

    // TwilioCallService takes its config by injection, so bind it in a child
    // container rather than mutating the root registry.
    const scope = container.createChildContainer()
    scope.register(TwilioVoiceConfig, { useValue: config })
    const service = scope.resolve(TwilioCallService)
    this.services.set(config, service)
    return service
  }
}

// A TwilioVoiceConfig only exists inside a voice channel's own container, so
// resolving TwilioCallService (or anything injecting it) from anywhere else used
// to fail with `TypeInfo not known for "Object"`. Answer those resolves with the
// declared channel's config — never a rebuilt one, so outbound cannot drift from
// inbound. Channel containers register their own config and shadow this.
container.register(TwilioVoiceConfig, {
  useFactory: () => container.resolve(TwilioCalls).defaultConfig(),
})
