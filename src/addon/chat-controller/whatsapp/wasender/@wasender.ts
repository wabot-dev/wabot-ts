import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { WasenderChannelConfig } from './WasenderChannelConfig'
import { type IWasenderChannelConfig } from './IWasenderChannelConfig'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { WasenderChannel } from './WasenderChannel'

export function wasender(config?: IWasenderChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const cfg: IWasenderChannelConfig = config ?? {}
    const resolvedConfig = resolveConfigReferences(cfg)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: WasenderChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new WasenderChannelConfig(resolvedConfig),
    })
  }
}
