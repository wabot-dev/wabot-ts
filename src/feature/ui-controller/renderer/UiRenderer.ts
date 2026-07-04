export interface IRenderContext {
  /** True while running under the dev server (enables hydration in dev, etc.). */
  dev?: boolean
  /**
   * Optional layout component to wrap the view in (the persistent app shell).
   * The renderer places the view where the layout renders its `<Outlet/>`.
   * Passed only for full-document loads; omitted for boosted-nav fragments so
   * only the view (the outlet's content) is rendered.
   */
  layout?: unknown
}

export interface IRenderedIsland {
  /** Stable island id (module-derived), used to load its client bundle. */
  id: string
  /** Serializable props the island was rendered with, for client hydration. */
  props: unknown
}

export interface IRenderResult {
  /** Server-rendered HTML for the view body. */
  html: string
  /** Islands encountered while rendering, in document order. */
  islands: IRenderedIsland[]
  /** Style hrefs (or inline CSS ids) the page depends on, if any. */
  styles: string[]
}

export interface IIslandEntryArgs {
  /** Stable island id (also the client bundle's output name). */
  id: string
  /** Absolute path to the island's source module (default export = island). */
  importPath: string
}

/** Renderer-specific knobs the island bundler needs to build client bundles. */
export interface IUiClientConfig {
  /** Module the generated island entry imports its hydration `registerIsland` from. */
  runtimeModule: string
  /** esbuild JSX settings for compiling islands on the client. */
  esbuildJsx?: {
    jsx?: 'automatic' | 'transform' | 'preserve'
    jsxImportSource?: string
    jsxFactory?: string
    jsxFragmentFactory?: string
  }
  /** Source of the client entry that registers one island for hydration. */
  islandEntrySource(args: IIslandEntryArgs): string
}

/**
 * A pluggable UI rendering engine. The default implementation is Preact
 * (`@wabot-dev/framework/ui`), but any framework can be adapted by implementing
 * this interface and registering it in {@link UiRendererRegistry}.
 */
export interface UiRenderer {
  /** Unique id, e.g. "preact" or "react". */
  readonly id: string
  /** Render a view's returned node tree to HTML, collecting island usage. */
  renderToString(node: unknown, context?: IRenderContext): IRenderResult | Promise<IRenderResult>
  /** Bundling/hydration config. Required to ship interactive islands. */
  readonly client?: IUiClientConfig
}
