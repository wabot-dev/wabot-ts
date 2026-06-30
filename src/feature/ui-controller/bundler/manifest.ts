import path from 'node:path'
import type { Metafile } from 'esbuild'

export interface IIslandAsset {
  /** URL of the island's client bundle. */
  js: string
  /** URLs of stylesheets the island bundle produced. */
  css: string[]
}

export interface IUiManifest {
  /** URL prefix every asset is served under, e.g. "/_wabot/". */
  base: string
  /** islandId -> built assets. */
  islands: Record<string, IIslandAsset>
}

export const ISLAND_ENTRY_NAMESPACE = 'wabot-island'

function toUrl(base: string, outdir: string, cwd: string, outPath: string): string {
  const abs = path.resolve(cwd, outPath)
  const rel = path.relative(outdir, abs).split(path.sep).join('/')
  return base + rel
}

/** Build the island asset manifest from an esbuild metafile. */
export function manifestFromMetafile(
  metafile: Metafile,
  opts: { base: string; outdir: string; cwd: string },
): IUiManifest {
  const { base, outdir, cwd } = opts
  const islands: Record<string, IIslandAsset> = {}

  for (const [outPath, output] of Object.entries(metafile.outputs)) {
    const entryPoint = output.entryPoint
    if (!entryPoint || !entryPoint.startsWith(`${ISLAND_ENTRY_NAMESPACE}:`)) continue
    const id = entryPoint.slice(ISLAND_ENTRY_NAMESPACE.length + 1)
    const css = output.cssBundle ? [toUrl(base, outdir, cwd, output.cssBundle)] : []
    islands[id] = { js: toUrl(base, outdir, cwd, outPath), css }
  }

  return { base, islands }
}

export function emptyManifest(base = '/_wabot/'): IUiManifest {
  return { base, islands: {} }
}
