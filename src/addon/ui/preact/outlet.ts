import { createContext, h } from 'preact'
import { useContext } from 'preact/hooks'
import type { ComponentChildren } from 'preact'

/** SSR context carrying the current view node so `<Outlet/>` can render it. */
export const OutletContext = createContext<ComponentChildren>(null)

/**
 * Placeholder a controller `layout` renders where the current view goes. Emits a
 * `<wabot-outlet>` host wrapping the view's server HTML; during boosted
 * navigation only this element's content is swapped, so the surrounding shell
 * (and its islands) keep their state.
 *
 *   function Layout() {
 *     return <div class="app"><Nav /><main><Outlet /></main></div>
 *   }
 *   @uiController({ path: '/panel', app: true, layout: Layout })
 */
export function Outlet() {
  const node = useContext(OutletContext)
  return h('wabot-outlet', { 'data-wabot-outlet': '' }, node)
}
