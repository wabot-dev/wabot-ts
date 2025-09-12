import { SocketControllerMetadataStore } from './SocketControllerMetadataStore'
import { ISocketControllerConfig } from './ISocketControllerConfig'
import { IConstructor } from '@/core/generics'
import { container, injectable } from '@/core/injection'

export function socketController(config?: string | ISocketControllerConfig) {
  return function (target: IConstructor<any>) {
    const metaDataStore = container.resolve(SocketControllerMetadataStore)
    metaDataStore.saveControllerMetadata({
      controllerConstructor: target,
      config: typeof config === 'string' ? { namespace: config } : config,
    })
    injectable()(target)
  }
}
