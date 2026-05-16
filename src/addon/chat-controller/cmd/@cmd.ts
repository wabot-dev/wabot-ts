import { ControllerMetadataStore } from '@/feature/chat-controller'
import { container } from '@/core/injection'
import { CmdChannel } from './CmdChannel'
import { CmdChannelConfig } from './CmdChannelConfig'
import type { IConstructor } from '@/core/generics'

export function cmd() {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    const controllerConstructor = target.constructor as IConstructor<any>
    const functionName = propertyKey.toString()
    const route = `${controllerConstructor.name}.${functionName}`
    store.saveChannelMetadata({
      channelConstructor: CmdChannel,
      functionName,
      controllerConstructor,
      channelConfig: new CmdChannelConfig(route),
    })
  }
}
