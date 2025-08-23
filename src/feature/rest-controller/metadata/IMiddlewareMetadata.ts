import { IConstructor } from '@/core/generics'
import { IMiddleware } from '../IMiddleware'

export interface IMiddlewareMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  middlewareConstructor: IConstructor<IMiddleware>
}
