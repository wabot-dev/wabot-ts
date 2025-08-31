import { container } from '@/core/injection'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'
import { IEndPointConfig } from './IEndPointConfig'

export function get(config?: string | IEndPointConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(RestControllerMetadataStore)
    store.saveEndPointMetadata({
      controllerConstructor: target.constructor as any,
      method: 'get',
      config: typeof config === 'string' ? { path: config } : config,
      functionName,
      paramsTypes,
    })
  }
}
