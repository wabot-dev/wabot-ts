import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { DiscordChannel } from './DiscordChannel'
import { DiscordChannelConfig } from './DiscordChannelConfig'
import type { IDiscordChannelConfig } from './IDiscordChannelConfig'

export function discord(config: IDiscordChannelConfig = {}) {
  return function (target: object, propertyKey: string | symbol) {
    const resolved = resolveConfigReferences(config)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: DiscordChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new DiscordChannelConfig(resolved.botToken, resolved.intents),
    })
  }
}
