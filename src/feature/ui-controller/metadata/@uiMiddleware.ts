import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'
import { UiControllerMetadataStore } from './UiControllerMetadataStore'

/**
 * Attach a middleware (e.g. an auth guard) to a single @view or @action.
 * Controller-wide middlewares can instead be declared on @uiController({ middlewares }).
 */
export function uiMiddleware(middlewareConstructor: IConstructor<IMiddleware>) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const store = container.resolve(UiControllerMetadataStore)
    store.saveMiddlewareMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      middlewareConstructor,
    })
  }
}
