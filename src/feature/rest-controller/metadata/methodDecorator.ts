import { container } from '@/core/injection'
import { IEndPointConfig } from './IEndPointConfig'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'

export function methodDecorator(
  method: 'get' | 'post' | 'put' | 'delete',
  config?: string | IEndPointConfig,
) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(RestControllerMetadataStore)
    store.saveEndPointMetadata({
      controllerConstructor: target.constructor as any,
      method,
      config: typeof config === 'string' ? { path: config } : config,
      functionName,
      paramsTypes,
    })
  }
}
