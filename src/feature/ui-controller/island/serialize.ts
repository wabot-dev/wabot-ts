const SKIP_PROPS = new Set(['children', 'ref', 'key'])

/**
 * Serialize the props an island was rendered with so the client can hydrate it
 * with the same data. Drops `children`/`ref`/`key` and any function-valued
 * props (event handlers belong inside the island, not in its serialized props).
 */
export function serializeProps(props: Record<string, unknown>): string {
  const out: Record<string, unknown> = {}
  for (const key in props) {
    if (SKIP_PROPS.has(key)) continue
    const value = props[key]
    if (typeof value === 'function') continue
    out[key] = value
  }
  try {
    return JSON.stringify(out)
  } catch {
    return '{}'
  }
}

export function deserializeProps(raw: string | undefined | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
