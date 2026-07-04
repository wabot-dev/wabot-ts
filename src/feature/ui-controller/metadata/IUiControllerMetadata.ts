import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'
import type { IControllerHead } from './IUiControllerConfig'

export interface IUiControllerMetadata {
  controllerConstructor: IConstructor<any>
  path: string
  middlewares: IConstructor<IMiddleware>[]
  /** Whether this controller opts into client-side ("boosted") navigation. */
  app?: boolean
  /** Persistent app-shell component rendered around every view (with an `<Outlet/>`). */
  layout?: unknown
  /** `<head>` resource hints (preconnect/preload) for full document loads. */
  head?: IControllerHead
}
