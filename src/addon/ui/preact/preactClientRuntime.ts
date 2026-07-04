// Browser hydration runtime for the Preact adapter. Bundled into the client by
// UiBundler and shared across islands (and the boosted-nav runtime). Each
// island's client bundle calls registerIsland(); this finds the matching
// <wabot-island> hosts and hydrates them with their serialized props.
//
// The boosted-navigation runtime imports hydrateAll()/unmountRemoved() from
// this same module. Because every island entry and the nav entry import this
// module, esbuild hoists it into a single shared chunk, so they all share the
// registry and mounted-hosts state below (one module instance per page).
import { h, hydrate, render } from 'preact'

const registry = new Map<string, any>()
// Hosts we have hydrated. Kept as an iterable Set (not a WeakSet) so the nav
// runtime can walk it to unmount hosts that have left the DOM after a swap.
const mounted = new Set<Element>()

export function registerIsland(id: string, Component: any): void {
  registry.set(id, Component)
  hydrateIsland(id)
}

function hydrateIsland(id: string): void {
  const Component = registry.get(id)
  if (!Component || typeof document === 'undefined') return

  const selector = `wabot-island[data-island="${id.replace(/["\\]/g, '\\$&')}"]`
  document.querySelectorAll(selector).forEach((el) => {
    if (mounted.has(el)) return
    let props: Record<string, unknown> = {}
    const raw = (el as HTMLElement).dataset.props
    if (raw) {
      try {
        props = JSON.parse(raw)
      } catch {
        props = {}
      }
    }
    hydrate(h(Component, props), el)
    mounted.add(el)
  })
}

/**
 * Hydrate any not-yet-mounted hosts for every registered island. Called by the
 * nav runtime after swapping in a new view: islands whose bundle already loaded
 * earlier in the session won't re-run their entry, so this picks up their new
 * hosts. Hosts of islands not yet loaded hydrate when their bundle imports.
 */
export function hydrateAll(): void {
  for (const id of registry.keys()) hydrateIsland(id)
}

/**
 * Unmount islands whose host is no longer in the document (removed by a view
 * swap), running Preact's teardown so effects/subscriptions don't leak.
 */
export function unmountRemoved(): void {
  if (typeof document === 'undefined') return
  for (const el of mounted) {
    if (!document.contains(el)) {
      render(null, el)
      mounted.delete(el)
    }
  }
}
