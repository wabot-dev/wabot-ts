/**
 * Returns true when an error from a chat adapter is worth retrying with another
 * model or another adapter (transient/availability issues), false when retrying
 * would just propagate the same configuration problem (auth, validation).
 */
export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true

  const status = readStatus(err)
  if (status !== undefined) {
    if (status === 408 || status === 425 || status === 429) return true
    if (status >= 500) return true
    if (status >= 400 && status < 500) return false
    return false
  }

  const code = readCode(err)
  if (code) {
    const transient = new Set([
      'ECONNRESET',
      'ECONNABORTED',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ENETUNREACH',
      'ENOTFOUND',
      'EPIPE',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
      'UND_ERR_SOCKET',
    ])
    if (transient.has(code)) return true
    return false
  }

  if (err instanceof Error) {
    const name = err.name
    if (name === 'AbortError' || name === 'TimeoutError' || name === 'FetchError') return true
  }

  return true
}

function readStatus(err: object): number | undefined {
  const candidates = [
    (err as { status?: unknown }).status,
    (err as { statusCode?: unknown }).statusCode,
    (err as { response?: { status?: unknown } }).response?.status,
  ]
  for (const c of candidates) {
    if (typeof c === 'number') return c
  }
  return undefined
}

function readCode(err: object): string | undefined {
  const c = (err as { code?: unknown }).code
  return typeof c === 'string' ? c : undefined
}
