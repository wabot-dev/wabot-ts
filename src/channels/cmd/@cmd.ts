import { ControllerMetadataStore } from '@/controller'
import { container } from '@/injection'
import { CmdChannel } from './CmdChannel'
import { type IConstructor } from '@/shared'

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
