import { container } from '@/core/injection'
import type { IConstructor } from '@/core/generics'
import { VoiceControllerMetadataStore } from '@/feature/voice-call'
import { TwilioVoiceChannel } from './TwilioVoiceChannel'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'

export interface ITwilioVoiceDecoratorConfig {
  /** Public origin Twilio uses to reach this server (e.g. your ngrok URL). */
  publicBaseUrl: string
  voice?: string
  webhookPath?: string
  mediaPath?: string
}

/**
 * Routes inbound Twilio calls to a voice controller method (analogous to
 * `@socket`/`@telegram`). The method receives the call and answers with a
 * `@voiceBot`.
 */
export function twilioVoice(config: ITwilioVoiceDecoratorConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const channelConfig = new TwilioVoiceConfig(
      config.publicBaseUrl,
      process.env.TWILIO_ACCOUNT_SID ?? '',
      process.env.TWILIO_AUTH_TOKEN ?? '',
      process.env.TWILIO_NUMBER ?? '',
      config.webhookPath,
      config.mediaPath,
      config.voice,
    )
    container.resolve(VoiceControllerMetadataStore).saveVoiceChannelMetadata({
      channelConstructor: TwilioVoiceChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig,
    })
  }
}
