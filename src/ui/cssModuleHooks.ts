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
import { buildCssAssetSource, buildCssModuleSource } from './cssModuleCompile'

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
    // A plain stylesheet becomes a cacheable asset: it registers its CSS and the
    // default export is the URL it's served at (use it in head.stylesheets).
    return {
      format: 'module' as const,
      shortCircuit: true,
      source: await buildCssAssetSource(fileURLToPath(url)),
    }
  }
  return nextLoad(url, context)
}
