import { fileURLToPath } from 'node:url'
import { h, options } from 'preact'
import { renderToString } from 'preact-render-to-string'
import type {
  IRenderContext,
  IRenderedIsland,
  IRenderResult,
  IUiClientConfig,
  UiRenderer,
} from '@/feature/ui-controller'
import { getIslandMeta, serializeProps } from '@/feature/ui-controller'
import { OutletContext } from './outlet'

/** Absolute path (no extension) to the browser hydration runtime, resolved by esbuild. */
const PREACT_CLIENT_RUNTIME = fileURLToPath(new URL('./preactClientRuntime', import.meta.url))

interface IslandCollector {
  islands: IRenderedIsland[]
  seen: Set<string>
}

let currentCollector: IslandCollector | null = null
const WRAPPED = '__wabotIslandWrapped'

// Global Preact diff hook (`__b`), invoked per vnode *during* rendering by
// preact-render-to-string. While an SSR collector is active, replace each
// island vnode with a <wabot-island> host element that wraps the island's
// server HTML and carries its serialized props, and record the island so the
// page can ship its client bundle. Installed once on import (server only).
const preactOptions = options as unknown as Record<string, ((vnode: any) => void) | undefined>
const previousDiffHook = preactOptions.__b
preactOptions.__b = (vnode: any) => {
  if (currentCollector && vnode && typeof vnode.type === 'function' && !vnode[WRAPPED]) {
    const meta = getIslandMeta(vnode.type)
    if (meta) {
      const props = vnode.props ?? {}
      const id = meta.id ?? meta.name
      if (!currentCollector.seen.has(id)) {
        currentCollector.seen.add(id)
        currentCollector.islands.push({ id, props })
      }
      vnode.type = 'wabot-island'
      vnode.props = {
        'data-island': id,
        'data-props': serializeProps(props),
        children: h(meta.component as any, props),
      }
      vnode[WRAPPED] = true
    }
  }
  previousDiffHook?.(vnode)
}

/**
 * Default UI renderer backed by Preact + @preact/signals. Renders views to HTML
 * and emits hydration hosts for any component wrapped with `island()`.
 */
export class PreactRenderer implements UiRenderer {
  readonly id = 'preact'

  readonly client: IUiClientConfig = {
    runtimeModule: PREACT_CLIENT_RUNTIME,
    esbuildJsx: { jsx: 'automatic', jsxImportSource: 'preact' },
    islandEntrySource: ({ id, importPath }) =>
      `import { registerIsland } from ${JSON.stringify(PREACT_CLIENT_RUNTIME)}\n` +
      `import Island from ${JSON.stringify(importPath)}\n` +
      `registerIsland(${JSON.stringify(id)}, Island)\n`,
  }

  renderToString(node: unknown, context?: IRenderContext): IRenderResult {
    // With a layout, render the view inside the shell where <Outlet/> sits.
    // Without one (or for boosted-nav fragments), render the view directly.
    const Layout = context?.layout as ((props: any) => any) | undefined
    const tree = Layout
      ? h(OutletContext.Provider, { value: node as any }, h(Layout, {}))
      : (node as any)

    const collector: IslandCollector = { islands: [], seen: new Set() }
    const previous = currentCollector
    currentCollector = collector
    try {
      const html = renderToString(tree)
      return { html, islands: collector.islands, styles: [] }
    } finally {
      currentCollector = previous
    }
  }
}
