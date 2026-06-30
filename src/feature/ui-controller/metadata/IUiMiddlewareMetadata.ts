import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'

export interface IUiMiddlewareMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  middlewareConstructor: IConstructor<IMiddleware>
}
