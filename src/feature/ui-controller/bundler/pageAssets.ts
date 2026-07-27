import type { IRenderedIsland } from '../renderer'
import type { IPageAssets } from '../runUiControllers'
import type { IUiManifest } from './manifest'

export interface IPageAssetsOptions {
  /** When set, injects a live-reload client pointing at this SSE endpoint (dev). */
  liveReloadPath?: string
  /** Port the live-reload server listens on, when it is not the app's own. */
  liveReloadPort?: number
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
    navScript: manifest.nav,
    bodyEndHtml: options.liveReloadPath
      ? liveReloadSnippet(options.liveReloadPath, options.liveReloadPort)
      : undefined,
  }
}

/**
 * Inline live-reload client. With a `port` the URL is built from the current
 * hostname, so the dev server keeps working when it is reached over the LAN
 * instead of localhost. The stream is closed while the tab is hidden: it holds
 * a connection open for as long as the page lives, and background tabs have no
 * use for it.
 */
export function liveReloadSnippet(path: string, port?: number): string {
  const url = port
    ? `location.protocol+"//"+location.hostname+":${port}"+${JSON.stringify(path)}`
    : JSON.stringify(path)
  return (
    `<script>(function(){var s;` +
    `function open(){try{s=new EventSource(${url});` +
    `s.onmessage=function(e){if(e.data==='reload')location.reload()};}catch(_){}}` +
    `function close(){if(s){s.close();s=null}}` +
    `document.addEventListener('visibilitychange',function(){` +
    `document.hidden?close():s||open()});` +
    `open()})()</script>`
  )
}
