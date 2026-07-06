// Shared `*.module.css` -> JS transform used by BOTH the SSR loader (dev/tests)
// and the production build plugin, so the server produces identical scoped class
// names in every mode. Names come from esbuild `local-css` with identifier
// minification OFF, giving deterministic `<basename>_<local>` names that match
// the island client bundles (which also disable identifier minification).
//
// The generated module exports the class map (default) and registers its CSS
// text with the server-side registry as an import-time side effect.

import { dirname } from 'node:path'
import * as esbuild from 'esbuild'

/** Public specifier the generated modules import the registry from. */
const CSS_RUNTIME_SPECIFIER = '@wabot-dev/framework/ui/css-runtime'

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
  const mapModule = built.outputFiles.find((out) => out.path.endsWith('.js'))?.text ?? 'export default {}'
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
