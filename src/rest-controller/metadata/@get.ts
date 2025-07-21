import { container } from '@/injection'
import { IGetConfig } from './IGetConfig'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'

export function get(config?: IGetConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(RestControllerMetadataStore)
    store.saveEndPointMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      method: 'get',
      path: config?.path,
      paramsTypes,
    })
  }
}
