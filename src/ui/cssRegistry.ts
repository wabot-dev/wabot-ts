// Server-side registry of the CSS emitted by `*.module.css` modules.
//
// Each compiled CSS module (produced by the SSR loader in dev and by the build
// plugin in prod) calls `registerModuleCss(id, css)` as an import-time side
// effect. The UI renderer then injects the collected CSS as a single <style> so
// server-rendered pages — views and islands alike — are styled with the same
// scoped class names the components render (esbuild `local-css`, unminified).
//
// Public entry: `@wabot-dev/framework/ui/css-runtime`. Dependency-free so it can
// be imported from generated CSS modules without pulling in esbuild.

const registry = new Map<string, string>()

export function registerModuleCss(id: string, css: string): void {
  if (css) registry.set(id, css)
}

/** All registered module CSS, concatenated (deduped by id). */
export function collectModuleCss(): string {
  return Array.from(registry.values()).join('')
}
