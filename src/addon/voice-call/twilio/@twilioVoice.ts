import { container } from '@/core/injection'
import type { ConfigReference } from '@/core/config'
import { resolveConfigReferences } from '@/core/config'
import type { IConstructor } from '@/core/generics'
import { VoiceControllerMetadataStore } from '@/feature/voice-call'
import { TwilioVoiceChannel } from './TwilioVoiceChannel'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'

export interface ITwilioVoiceDecoratorConfig {
  /** Public origin Twilio uses to reach this server (e.g. your ngrok URL). */
  publicBaseUrl: string | ConfigReference<string>
  voice?: string | ConfigReference<string>
  /** Webhook route for this channel. Give each channel a distinct path. */
  webhookPath?: string | ConfigReference<string>
  /** Media-stream route for this channel. Give each channel a distinct path. */
  mediaPath?: string | ConfigReference<string>
  /** Verify Twilio's `X-Twilio-Signature` on this channel's webhook. */
  verifySignature?: boolean | ConfigReference<boolean>
  /**
   * Auth token used to verify signatures. Defaults to `TWILIO_AUTH_TOKEN`; for
   * multi-account routes the token of the account owning the called number
   * (TwilioAccountRegistry) is also tried.
   */
  authToken?: string | ConfigReference<string>
  /**
   * Caller-ID numbers Twilio routes to this channel's webhook — the same numbers
   * you point at `webhookPath` in the Twilio console. Outbound calls select this
   * channel by `from`: `TwilioCalls.initiate({ from })` dials through the channel
   * whose `numbers` include `from`. Only needed to disambiguate when an app
   * declares several `@twilioVoice` channels.
   */
  numbers?: string[] | ConfigReference<string[]>
}

/**
 * Routes inbound Twilio calls to a voice controller method (analogous to
 * `@socket`/`@telegram`). The method receives the call and answers with a
 * `@voiceBot`. Each decorator builds its own channel config, so different
 * methods can serve different webhook routes and signature settings.
 *
 * Config values may be literals or core config references (`str`/`bool`), e.g.
 * `verifySignature: bool\`twilio.verify.signature:false\`` — resolved here from
 * the environment with coercion and defaults, like the chat channel decorators.
 */
export function twilioVoice(config: ITwilioVoiceDecoratorConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const resolved = resolveConfigReferences(config)
    const channelConfig = new TwilioVoiceConfig({
      publicBaseUrl: resolved.publicBaseUrl,
      webhookPath: resolved.webhookPath,
      mediaPath: resolved.mediaPath,
      voice: resolved.voice,
      authToken: resolved.authToken,
      verifySignature: resolved.verifySignature,
      numbers: resolved.numbers,
    })
    container.resolve(VoiceControllerMetadataStore).saveVoiceChannelMetadata({
      channelConstructor: TwilioVoiceChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig,
    })
  }
}
