import type { IRenderedIsland } from '../renderer'
import type { IPageAssets } from '../runUiControllers'
import type { IUiManifest } from './manifest'

export interface IPageAssetsOptions {
  /** When set, injects a live-reload client pointing at this SSE endpoint (dev). */
  liveReloadPath?: string
}

/** Map the islands a page rendered to the script/style tags it needs. */
export function pageAssetsFromManifest(
  manifest: IUiManifest,
  islands: IRenderedIsland[],
  options: IPageAssetsOptions = {},
): IPageAssets {
  const scripts: string[] = []
  const styles: string[] = []
  const seen = new Set<string>()

  for (const island of islands) {
    if (seen.has(island.id)) continue
    seen.add(island.id)
    const asset = manifest.islands[island.id]
    if (!asset) continue
    scripts.push(asset.js)
    for (const css of asset.css) if (!styles.includes(css)) styles.push(css)
  }

  return {
    scripts,
    styles,
    bodyEndHtml: options.liveReloadPath ? liveReloadSnippet(options.liveReloadPath) : undefined,
  }
}

export function liveReloadSnippet(path: string): string {
  return (
    `<script>(function(){try{var s=new EventSource(${JSON.stringify(path)});` +
    `s.onmessage=function(e){if(e.data==='reload')location.reload()};}catch(_){}})()</script>`
  )
}
