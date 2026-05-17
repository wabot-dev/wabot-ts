import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import { TelegramChannel } from './TelegramChannel'
import { type ITelegramChannelConfig, TelegramChannelConfig } from './TelegramChannelConfig'
import type { IConstructor } from '@/core/generics'

export function telegram(config: ITelegramChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const resolved = resolveConfigReferences(config)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: TelegramChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new TelegramChannelConfig(resolved.botToken),
    })
  }
}
