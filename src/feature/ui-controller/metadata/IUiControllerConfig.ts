import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'

export interface IUiControllerConfig {
  /** Base path every view/action of the controller is mounted under. */
  path: string
  /** Middlewares (e.g. auth guards) applied to every view and action. */
  middlewares?: IConstructor<IMiddleware>[]
  /**
   * Opt into client-side ("boosted") navigation between this controller's
   * views: links within the controller's `path` are intercepted and swapped in
   * without a full browser reload, backed by a stale-while-revalidate cache.
   * Views still SSR normally and keep working without JS. Defaults to false.
   */
  app?: boolean
  /**
   * Persistent app shell rendered once around every view of the controller. The
   * layout renders an `<Outlet/>` where the current view goes; during boosted
   * navigation only the outlet swaps, so the shell (and its islands) keep their
   * state. A renderer component (e.g. a Preact function component).
   */
  layout?: unknown
}
