import { IConstructor } from '@/core/generics'
import { IHandshakeMiddleware } from '../IHandshakeMiddleware'
import { SocketControllerMetadataStore } from './SocketControllerMetadataStore'
import { container } from '@/core/injection'

export function handshakeMiddlewares(middlewares: IConstructor<IHandshakeMiddleware>[]) {
  return function (target: IConstructor<any>) {
    const store = container.resolve(SocketControllerMetadataStore)

    for (const mw of middlewares) {
      store.saveHandshakeMiddlewareMetadata({
        controllerConstructor: target.constructor as any,
        middlewareConstructor: mw,
      })
    }
  }
}
