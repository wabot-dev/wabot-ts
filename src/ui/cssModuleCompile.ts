// Shared `*.module.css` -> JS transform used by BOTH the SSR loader (dev/tests)
// and the production build plugin, so the server produces identical scoped class
// names in every mode. Names come from esbuild `local-css` with identifier
// minification OFF, giving deterministic `<basename>_<local>` names that match
// the island client bundles (which also disable identifier minification).
//
// The generated module exports the class map (default) and registers its CSS
// text with the server-side registry as an import-time side effect.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import * as esbuild from 'esbuild'

/** Public specifier the generated modules import the registry from. */
const CSS_RUNTIME_SPECIFIER = '@wabot-dev/framework/ui/css-runtime'

/** URL a plain-CSS asset is served at (see `getCssAsset` + the UI runner route). */
export function cssAssetHref(hash: string): string {
  return `/_wabot/css/${hash}.css`
}

interface ICompiled {
  /** esbuild's JS output — a self-contained module exporting the class map. */
  mapModule: string
  /** The compiled (scoped) CSS text. */
  css: string
}

async function compile(file: string): Promise<ICompiled> {
  const built = await esbuild.build({
    stdin: {
      contents: `export { default } from ${JSON.stringify(file)}`,
      resolveDir: dirname(file),
      loader: 'js',
      sourcefile: 'wabot-css-module.js',
    },
    bundle: true,
    write: false,
    format: 'esm',
    // outdir is required so the imported stylesheet has an output path; we keep
    // both the JS class map and the CSS text from the in-memory output.
    outdir: '.wabot-ssr-css',
    absWorkingDir: process.cwd(),
    loader: { '.module.css': 'local-css' },
    // Names must stay unminified to match the island client bundles.
    minifyIdentifiers: false,
    logLevel: 'silent',
  })
  const mapModule =
    built.outputFiles.find((out) => out.path.endsWith('.js'))?.text ?? 'export default {}'
  const css = built.outputFiles.find((out) => out.path.endsWith('.css'))?.text ?? ''
  return { mapModule, css }
}

/**
 * Build the JS module source for a `*.module.css`: exports the scoped class map
 * and registers its CSS with the server registry so the renderer can inject it.
 */
export async function buildCssModuleSource(file: string): Promise<string> {
  const { mapModule, css } = await compile(file)
  return (
    `import { registerModuleCss as __registerModuleCss } from ${JSON.stringify(CSS_RUNTIME_SPECIFIER)}\n` +
    mapModule +
    `\n__registerModuleCss(${JSON.stringify(file)}, ${JSON.stringify(css)})\n`
  )
}

/**
 * Build the JS module source for a plain (non-module) `*.css`: registers the CSS
 * under a content hash and exports the URL it is served at, so
 * `import href from './x.css'` yields a cacheable stylesheet URL.
 */
export async function buildCssAssetSource(file: string): Promise<string> {
  const css = await readFile(file, 'utf8')
  const hash = createHash('sha1').update(css).digest('hex').slice(0, 16)
  return (
    `import { registerCssAsset as __registerCssAsset } from ${JSON.stringify(CSS_RUNTIME_SPECIFIER)}\n` +
    `__registerCssAsset(${JSON.stringify(hash)}, ${JSON.stringify(css)})\n` +
    `export default ${JSON.stringify(cssAssetHref(hash))}\n`
  )
}
