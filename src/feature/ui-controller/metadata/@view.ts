import { container } from '@/core/injection'
import { IViewConfig } from './IViewConfig'
import { UiControllerMetadataStore } from './UiControllerMetadataStore'

export function view(config?: string | IViewConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(UiControllerMetadataStore)
    store.saveViewMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      config: typeof config === 'string' ? { path: config } : config,
      paramsTypes,
    })
  }
}
