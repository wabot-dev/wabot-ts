import { escapeAttr, escapeHtml } from './escape'

export interface IDocumentOptions {
  /** Server-rendered HTML placed inside <body>. */
  bodyHtml: string
  /** Document title. */
  title?: string
  /** <meta name=.. content=..> tags. */
  meta?: Record<string, string>
  /** Stylesheet hrefs rendered as <link rel="stylesheet">. */
  styles?: string[]
  /** Extra <link> tags (preload/preconnect/…) as attribute maps. `true` => bare attribute. */
  links?: Array<Record<string, string | boolean>>
  /** Module script srcs rendered as <script type="module">. */
  scripts?: string[]
  /** Raw HTML appended to <head> (e.g. inline bootstrap data). */
  headHtml?: string
  /** Raw HTML appended to the end of <body> (e.g. dev live-reload snippet). */
  bodyEndHtml?: string
  /** <html lang>. Defaults to "en". */
  lang?: string
}

/**
 * Render the default HTML document shell around a view's body. Kept
 * renderer-agnostic (plain string templating) so it works with any UiRenderer.
 */
export function renderDocument(options: IDocumentOptions): string {
  const {
    bodyHtml,
    title,
    meta = {},
    styles = [],
    links = [],
    scripts = [],
    headHtml = '',
    bodyEndHtml = '',
    lang = 'en',
  } = options

  const titleTag = title ? `<title>${escapeHtml(title)}</title>` : ''
  const metaTags = Object.entries(meta)
    .map(([name, content]) => `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}">`)
    .join('')
  // Preload/preconnect first so the browser starts fetching those before CSS.
  const linkTags = links.map((attrs) => `<link ${renderAttrs(attrs)}>`).join('')
  const styleTags = styles
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`)
    .join('')
  const scriptTags = scripts
    .map((src) => `<script type="module" src="${escapeAttr(src)}"></script>`)
    .join('')

  return (
    `<!doctype html><html lang="${escapeAttr(lang)}"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    titleTag +
    metaTags +
    linkTags +
    styleTags +
    headHtml +
    `</head><body>` +
    bodyHtml +
    scriptTags +
    bodyEndHtml +
    `</body></html>`
  )
}

/** Render an attribute map: string => key="value", `true` => bare key, false/null skipped. */
function renderAttrs(attrs: Record<string, string | boolean>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== false && value != null)
    .map(([key, value]) =>
      value === true ? escapeAttr(key) : `${escapeAttr(key)}="${escapeAttr(String(value))}"`,
    )
    .join(' ')
}
