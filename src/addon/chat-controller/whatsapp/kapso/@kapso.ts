import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { KapsoChannel } from './KapsoChannel'
import { KapsoChannelConfig } from './KapsoChannelConfig'
import { type IKapsoChannelConfig } from './IKapsoChannelConfig'

export function kapso(config?: IKapsoChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const cfg: IKapsoChannelConfig = config ?? {}
    const resolvedConfig = resolveConfigReferences(cfg)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: KapsoChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new KapsoChannelConfig(resolvedConfig),
    })
  }
}
