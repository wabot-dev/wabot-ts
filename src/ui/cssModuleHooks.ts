// Node module-customization hooks that let the server (SSR / dev / tests) import
// stylesheets the same way the production build does:
//
//   import styles from './Card.module.css'   // -> scoped class map + registered CSS
//   import './global.css'                     // -> no-op on the server
//
// `*.module.css` is compiled with the shared `buildCssModuleSource` transform
// (esbuild `local-css`, unminified) so the scoped class names match the island
// client bundles, and each module registers its CSS with the server registry so
// the renderer can inject it — styling views and islands alike.
//
// Registered by `cssModuleLoader.ts`; add it to your run scripts with
// `node --import @wabot-dev/framework/ui/css-loader ...`.

import { fileURLToPath } from 'node:url'
import { buildCssModuleSource } from './cssModuleCompile'

type NextLoad = (url: string, context: unknown) => unknown

export async function load(url: string, context: unknown, nextLoad: NextLoad) {
  if (url.startsWith('file://') && url.endsWith('.module.css')) {
    return {
      format: 'module' as const,
      shortCircuit: true,
      source: await buildCssModuleSource(fileURLToPath(url)),
    }
  }
  if (url.startsWith('file://') && url.endsWith('.css')) {
    // A plain global stylesheet is injected via <link> by the bundler, so it is a
    // no-op module on the server.
    return { format: 'module' as const, shortCircuit: true, source: 'export default ""' }
  }
  return nextLoad(url, context)
}
