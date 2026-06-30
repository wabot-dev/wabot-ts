import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'

export interface IUiControllerConfig {
  /** Base path every view/action of the controller is mounted under. */
  path: string
  /** Middlewares (e.g. auth guards) applied to every view and action. */
  middlewares?: IConstructor<IMiddleware>[]
}
