import { container } from '@/core/injection'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'
import { IPostConfig } from './IPostConfig'

export function post(config?: string | IPostConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(RestControllerMetadataStore)
    store.saveEndPointMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      method: 'post',
      path: typeof config === 'string' ? config : config?.path,
      paramsTypes,
    })
  }
}
