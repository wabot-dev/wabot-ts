import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { SocketChannel } from './SocketChannel'
import { SocketChannelConfig } from './SocketChannelConfig'
import type { ISocketChannelConfig } from './ISocketChannelConfig'

export function socket(config: ISocketChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const resolved = resolveConfigReferences(config)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: SocketChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new SocketChannelConfig(resolved),
    })
  }
}
