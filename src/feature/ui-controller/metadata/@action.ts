import { container } from '@/core/injection'
import { IActionConfig } from './IActionConfig'
import { UiControllerMetadataStore } from './UiControllerMetadataStore'

export function action(config?: string | IActionConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(UiControllerMetadataStore)
    store.saveActionMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      config: typeof config === 'string' ? { path: config } : config,
      paramsTypes,
    })
  }
}
