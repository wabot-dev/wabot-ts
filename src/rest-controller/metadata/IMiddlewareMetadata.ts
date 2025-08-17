import { IConstructor } from '@/core'
import { IMiddleware } from '../IMiddleware'

export interface IMiddlewareMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  middlewareConstructor: IConstructor<IMiddleware>
}
