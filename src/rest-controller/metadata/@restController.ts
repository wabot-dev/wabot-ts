import { IConstructor } from '@/core'
import { IRestControllerConfig } from './IRestControllerConfig'
import { container, injectable } from '@/injection'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'

export function restController(config: IRestControllerConfig) {
  return function (target: IConstructor<any>) {
    const metaDataStore = container.resolve(RestControllerMetadataStore)
    metaDataStore.saveControllerMetadata({
      controllerConstructor: target,
      path: config.path,
    })
    injectable()(target)
  }
}
