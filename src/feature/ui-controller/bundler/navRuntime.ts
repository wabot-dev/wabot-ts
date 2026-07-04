// Generic client runtime for "boosted" navigation between the views of an
// `app: true` UI controller. Renderer-agnostic: the island hydrate/unmount
// hooks are injected by the bundled nav entry (which imports them from the
// renderer's runtime module, so they share the island registry singleton).
//
// Flow per in-scope <a> click / popstate:
//   1. If the URL is cached -> apply it instantly (front-only navigation),
//      then revalidate in the background unless still "fresh" (swr.maxAge).
//   2. Otherwise fetch the fragment, apply it, and cache it.
// Revalidation sends If-None-Match; a 304 means nothing changed (no re-render),
// a 200 swaps only the changed fragment. Any failure falls back to a hard load,
// so navigation is always a progressive enhancement over normal links.

export interface INavHooks {
  /** Hydrate not-yet-mounted island hosts in the current DOM. */
  hydrateAll(): void
  /** Unmount island hosts that have left the DOM. */
  unmountRemoved(): void
}

interface IFragment {
  html: string
  title?: string | null
  meta?: Record<string, string> | null
  scripts?: string[]
  styles?: string[]
  maxAge?: number
}

interface ICacheEntry extends IFragment {
  etag: string
  /** epoch ms the entry was last validated. */
  ts: number
}

const NAV_HEADER = 'X-Wabot-Nav'
const NOT_MODIFIED = Symbol('not-modified')

declare global {
  interface Window {
    __wabotApp?: { routes: string[] }
    __wabotNav?: {
      revalidate(url?: string): void
      mutate(url: string, fragment?: Partial<IFragment>): void
    }
  }
}

export const normalizePath = (pathname: string) => '/' + pathname.replace(/^\/+|\/+$/g, '')

/** Compile an Express-style route pattern (":param" segments, "*") into a matcher. */
export function compileRoute(pattern: string): RegExp {
  const source = normalizePath(pattern)
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) return '[^/]+'
      if (seg === '*') return '.*'
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return new RegExp('^' + source + '$')
}

/** True when the pathname matches any of the controller's route patterns. */
export function matchesRoute(pathname: string, patterns: string[]): boolean {
  const p = normalizePath(pathname)
  return patterns.some((pattern) => compileRoute(pattern).test(p))
}

export function startNavigation(hooks: INavHooks): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  // Soft-navigate only the controller's declared view routes (matched as
  // patterns so ":param" routes work), so an app mounted at "/" doesn't
  // intercept links to the rest of the origin.
  const routes = window.__wabotApp?.routes
  if (!routes || routes.length === 0) return
  const matchers = routes.map(compileRoute)

  const cache = new Map<string, ICacheEntry>()
  const keyOf = (url: URL) => url.pathname + url.search
  const currentKey = () => location.pathname + location.search

  const inScope = (url: URL) =>
    url.origin === location.origin && matchers.some((m) => m.test(normalizePath(url.pathname)))

  history.replaceState({ __wabot: true }, '', location.href)

  document.addEventListener('click', onClick)
  window.addEventListener('popstate', () => navigate(location.href, false))

  // Public hooks for manual revalidation / optimistic updates from island code.
  window.__wabotNav = {
    revalidate(url?: string) {
      const key = url ? keyOf(new URL(url, location.href)) : currentKey()
      const entry = cache.get(key)
      if (entry) revalidate(key, location.origin + key, entry)
      else if (key === currentKey()) navigate(location.href, false)
    },
    mutate(url: string, fragment?: Partial<IFragment>) {
      const key = keyOf(new URL(url, location.href))
      if (!fragment) {
        cache.delete(key)
        return
      }
      const prev = cache.get(key)
      const next: ICacheEntry = {
        html: '',
        ...prev,
        ...fragment,
        etag: prev?.etag ?? '',
        ts: Date.now(),
      }
      cache.set(key, next)
      if (key === currentKey()) apply(next)
    },
  }

  function onClick(e: MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    const anchor = (e.target as Element | null)?.closest?.('a')
    if (!anchor) return
    if (
      anchor.target === '_blank' ||
      anchor.hasAttribute('download') ||
      anchor.getAttribute('rel') === 'external' ||
      anchor.dataset.wabotReload != null
    )
      return
    const href = anchor.getAttribute('href')
    if (!href || href.startsWith('#')) return
    const url = new URL(href, location.href)
    if (!inScope(url)) return
    e.preventDefault()
    if (keyOf(url) === currentKey()) return
    navigate(url.href, true)
  }

  async function navigate(href: string, push: boolean): Promise<void> {
    const url = new URL(href, location.href)
    // popstate can land on a URL outside the app (e.g. the entry page); hard-load it.
    if (!inScope(url)) return hardNav(href)
    const key = keyOf(url)
    const cached = cache.get(key)

    if (cached) {
      apply(cached, { scroll: push })
      if (push) history.pushState({ __wabot: true }, '', href)
      const fresh = (cached.maxAge ?? 0) > 0 && Date.now() - cached.ts < (cached.maxAge ?? 0) * 1000
      if (!fresh) revalidate(key, href, cached)
      return
    }

    try {
      const result = await fetchFragment(href, null)
      if (result === NOT_MODIFIED || !result) return hardNav(href)
      cache.set(key, result)
      apply(result, { scroll: push })
      if (push) history.pushState({ __wabot: true }, '', href)
    } catch {
      hardNav(href)
    }
  }

  async function revalidate(key: string, href: string, cached: ICacheEntry): Promise<void> {
    try {
      const result = await fetchFragment(href, cached.etag)
      if (result === NOT_MODIFIED) {
        cached.ts = Date.now()
        return
      }
      if (!result) return
      cache.set(key, result)
      if (currentKey() === key) apply(result)
    } catch {
      /* keep showing the stale entry on revalidation errors */
    }
  }

  async function fetchFragment(
    href: string,
    etag: string | null,
  ): Promise<ICacheEntry | typeof NOT_MODIFIED | null> {
    const headers: Record<string, string> = { [NAV_HEADER]: '1', Accept: 'application/json' }
    if (etag) headers['If-None-Match'] = etag
    const res = await fetch(href, { headers, credentials: 'same-origin' })
    if (res.status === 304) return NOT_MODIFIED
    if (!res.ok) return null
    const ct = res.headers.get('Content-Type') ?? ''
    if (!ct.includes('application/json')) return null
    const data = (await res.json()) as IFragment
    return { ...data, etag: res.headers.get('ETag') ?? '', ts: Date.now() }
  }

  async function apply(entry: ICacheEntry, opts: { scroll?: boolean } = {}): Promise<void> {
    ensureStyles(entry.styles ?? [])
    // With a layout, only the outlet swaps so the shell (and its islands) keep
    // their state; without one, the fragment is the whole body.
    const target = document.querySelector('wabot-outlet') ?? document.body
    swapContent(target, entry.html)
    hooks.unmountRemoved()
    if (entry.title != null) document.title = entry.title
    applyMeta(entry.meta ?? null)
    await Promise.all((entry.scripts ?? []).map((src) => import(src).catch(() => {})))
    hooks.hydrateAll()
    if (opts.scroll) window.scrollTo(0, 0)
  }

  // Replace the target's content, but preserve live island hosts (their mounted
  // Preact tree) across the swap when their serialized props are unchanged.
  // Changed props fall through to a fresh SSR host so revalidated data renders.
  function swapContent(target: Element, html: string): void {
    const live = new Map<string, Element>()
    target.querySelectorAll('wabot-island[data-island]').forEach((el) => {
      const id = el.getAttribute('data-island')
      if (id && !live.has(id)) live.set(id, el)
    })

    target.innerHTML = html
    if (live.size === 0) return

    target.querySelectorAll('wabot-island[data-island]').forEach((placeholder) => {
      const id = placeholder.getAttribute('data-island')
      if (!id) return
      const kept = live.get(id)
      if (!kept) return
      if (kept.getAttribute('data-props') === placeholder.getAttribute('data-props')) {
        placeholder.replaceWith(kept)
      }
      live.delete(id)
    })
  }

  function ensureStyles(hrefs: string[]): void {
    for (const href of hrefs) {
      if (document.querySelector(`link[rel="stylesheet"][href="${cssEscape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }

  function applyMeta(meta: Record<string, string> | null): void {
    if (!meta) return
    for (const [name, content] of Object.entries(meta)) {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${cssEscape(name)}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', name)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }
  }

  function hardNav(href: string): void {
    location.href = href
  }
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
