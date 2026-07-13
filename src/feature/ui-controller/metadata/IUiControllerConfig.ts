import { IConstructor } from '@/core/generics'
import type { IMiddleware } from '@/feature/rest-controller'

/** A resource to `<link rel="preload">` (font, critical image, …). */
export interface IPreloadLink {
  href: string
  /** Destination: 'font' | 'image' | 'style' | 'script' | 'fetch' | … */
  as: string
  /** MIME type, e.g. 'font/woff2'. Recommended so the preload matches the request. */
  type?: string
  /**
   * CORS mode. Fonts are always fetched cross-origin, so `as: 'font'` defaults to
   * `true` (a bare `crossorigin`) — omitting it would fetch the font twice.
   */
  crossorigin?: boolean | 'anonymous' | 'use-credentials'
  media?: string
}

/** An origin to `<link rel="preconnect">` (e.g. a font CDN). */
export type IPreconnect = string | { href: string; crossorigin?: boolean }

/** Extra `<head>` resources rendered on full document loads. */
export interface IControllerHead {
  /** Origins to open a connection to early (TLS handshake), e.g. a font host. */
  preconnect?: IPreconnect[]
  /** Resources to fetch early in parallel (fonts, hero image, …). */
  preload?: IPreloadLink[]
  /**
   * External stylesheet hrefs, rendered as `<link rel="stylesheet">` in the head.
   * Use this for a global/design-system stylesheet served as a cacheable file
   * (loaded once, shared across pages and kept across boosted navigation) instead
   * of inlining CSS into every page.
   */
  stylesheets?: string[]
}

export interface IUiControllerConfig {
  /** Base path every view/action of the controller is mounted under. */
  path: string
  /** Middlewares (e.g. auth guards) applied to every view and action. */
  middlewares?: IConstructor<IMiddleware>[]
  /**
   * Opt into client-side ("boosted") navigation between this controller's
   * views: links within the controller's `path` are intercepted and swapped in
   * without a full browser reload, backed by a stale-while-revalidate cache.
   * Views still SSR normally and keep working without JS. Defaults to false.
   */
  app?: boolean
  /**
   * Persistent app shell rendered once around every view of the controller. The
   * layout renders an `<Outlet/>` where the current view goes; during boosted
   * navigation only the outlet swaps, so the shell (and its islands) keep their
   * state. A renderer component (e.g. a Preact function component).
   */
  layout?: unknown
  /**
   * `<head>` resource hints (preconnect/preload) rendered on full document
   * loads — the natural home for app-wide fonts, since the head persists across
   * boosted navigation and is cached for the whole session.
   */
  head?: IControllerHead
}
