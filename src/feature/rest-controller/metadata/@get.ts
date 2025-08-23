import { container } from '@/core/injection'
import { IGetConfig } from './IGetConfig'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'

export function get(config?: string | IGetConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(RestControllerMetadataStore)
    store.saveEndPointMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      method: 'get',
      path: typeof config === 'string' ? config : config?.path,
      paramsTypes,
    })
  }
}
