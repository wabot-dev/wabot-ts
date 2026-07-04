import { IConstructor } from '@/core/generics'
import { container, injectable } from '@/core/injection'
import { IUiControllerConfig } from './IUiControllerConfig'
import { UiControllerMetadataStore } from './UiControllerMetadataStore'

export function uiController(config: string | IUiControllerConfig) {
  return function (target: IConstructor<any>) {
    const store = container.resolve(UiControllerMetadataStore)
    store.saveControllerMetadata({
      controllerConstructor: target,
      path: typeof config === 'string' ? config : config.path,
      middlewares: typeof config === 'string' ? [] : (config.middlewares ?? []),
      app: typeof config === 'string' ? false : (config.app ?? false),
      layout: typeof config === 'string' ? undefined : config.layout,
    })
    injectable()(target)
  }
}
