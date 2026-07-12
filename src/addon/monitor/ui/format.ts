export const fmt = (n: number): string => n.toLocaleString('en-US')

export const fmtTime = (ms: number | null): string =>
  ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—'

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

export const pageOf = (raw: string | undefined): number => Math.max(1, Number(raw) || 1)

export const limitOf = (raw: string | undefined, def = 50, max = 200): number =>
  clamp(Number(raw) || def, 1, max)

/** Pretty-print a JSON string; fall back to the raw string if it isn't JSON. */
export const prettyJson = (s: string | null | undefined): string | null => {
  if (!s) return null
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

/** Drop null/empty fields from a query DTO so hrefs stay clean. */
export const queryRecord = (q: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Record<string, string>
