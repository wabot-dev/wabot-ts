import { container } from '@/injection'
import { ControllerMetadataStore } from '@/controller'
import { TelegramChannel } from './TelegramChannel'
import { type ITelegramChannelConfig, TelegramChannelConfig } from './TelegramChannelConfig'
import { type IConstructor } from '@/shared'

export function telegram(config: ITelegramChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: TelegramChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new TelegramChannelConfig(config.botToken),
    })
  }
}
