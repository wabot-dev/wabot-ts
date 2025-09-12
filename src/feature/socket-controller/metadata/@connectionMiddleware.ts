import { IConstructor } from '@/core/generics'
import { IConnectionMiddleware } from '../IConnectionMiddleware'
import { SocketControllerMetadataStore } from './SocketControllerMetadataStore'
import { container } from '@/core/injection'

export function connectionMiddleware(middlewareConstructor: IConstructor<IConnectionMiddleware>) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const store = container.resolve(SocketControllerMetadataStore)
    store.saveConnectionMiddlewareMetadata({
      controllerConstructor: target.constructor as any,
      functionName,
      middlewareConstructor: middlewareConstructor,
    })
  }
}
