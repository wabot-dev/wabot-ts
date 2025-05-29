
import { container, ControllerMetadataStore, type IConstructor } from "@/index"
import { SocketChannel } from "./SocketChannel"
import { SocketChannelConfig } from "./SocketChannelConfig"

export function socket(config : SocketChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: SocketChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new SocketChannelConfig(config.channel),
    })
  }
}