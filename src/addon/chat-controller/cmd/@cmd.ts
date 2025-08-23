import { ControllerMetadataStore } from '@/feature/chat-controller'
import { container } from '@/core/injection'
import { CmdChannel } from './CmdChannel'
import type { IConstructor } from '@/core/generics'

export function cmd() {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: CmdChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
    })
  }
}
