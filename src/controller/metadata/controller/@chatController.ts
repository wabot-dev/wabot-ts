import { container, injectable } from '@/injection'
import { type IchatControllerConfig } from './IChatControllerConfig'
import { type IConstructor } from '@/core'
import { ControllerMetadataStore } from '../ControllerMetadataStore'

export function chatController(config?: IchatControllerConfig) {
  return function (target: IConstructor<any>) {
    const controllerMetaDataStore = container.resolve(ControllerMetadataStore)
    controllerMetaDataStore.saveChatControllerMetadata({
      controllerConstructor: target,
    })
    injectable()(target)
  }
}
