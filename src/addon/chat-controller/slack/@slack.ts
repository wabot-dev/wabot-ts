import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import { SlackChannel } from './SlackChannel'
import { type ISlackChannelConfig, SlackChannelConfig } from './SlackChannelConfig'
import type { IConstructor } from '@/core/generics'

export function slack(config: ISlackChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const resolved = resolveConfigReferences(config)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: SlackChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new SlackChannelConfig(
        resolved.appToken,
        resolved.botToken,
        resolved.signingSecret,
      ),
    })
  }
}
