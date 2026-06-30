// Browser hydration runtime for the Preact adapter. Bundled into the client by
// UiBundler and shared across islands. Each island's client bundle calls
// registerIsland(); this finds the matching <wabot-island> hosts and hydrates
// them with their serialized props.
import { h, hydrate } from 'preact'

const registry = new Map<string, any>()
const hydrated = new WeakSet<Element>()

export function registerIsland(id: string, Component: any): void {
  registry.set(id, Component)
  hydrateIsland(id)
}

function hydrateIsland(id: string): void {
  const Component = registry.get(id)
  if (!Component || typeof document === 'undefined') return

  const selector = `wabot-island[data-island="${id.replace(/["\\]/g, '\\$&')}"]`
  document.querySelectorAll(selector).forEach((el) => {
    if (hydrated.has(el)) return
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
    hydrated.add(el)
  })
}
