import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'

export interface IUiControllerMetadata {
  controllerConstructor: IConstructor<any>
  path: string
  middlewares: IConstructor<IMiddleware>[]
}
