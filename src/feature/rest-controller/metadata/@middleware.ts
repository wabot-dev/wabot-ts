import { container } from '@/core/injection'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'
import { IConstructor } from '@/core/generics'
import { IMiddleware } from '../IMiddleware'

export function middleware(middlewareConstructor: IConstructor<IMiddleware>) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const store = container.resolve(RestControllerMetadataStore)
    store.saveMiddlewareMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      middlewareConstructor: middlewareConstructor,
    })
  }
}
