import { IConstructor } from '@/core/generics'
import { IHandshakeMiddleware } from '../IHandshakeMiddleware'

export interface IHandshakeMiddlewareMetadata {
  controllerConstructor: IConstructor<any>
  middlewareConstructor: IConstructor<IHandshakeMiddleware>
}
