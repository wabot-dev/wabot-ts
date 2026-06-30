// Client-safe helpers for calling @action endpoints. No Node imports so these
// can be bundled into islands.

function joinUrl(...parts: string[]): string {
  const joined = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return '/' + joined
}

/** Build the URL of an @action: `<controllerPath>/_action/<actionName>`. */
export function actionUrl(controllerPath: string, actionName: string): string {
  return joinUrl(controllerPath, '_action', actionName)
}

export interface ICallActionOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * POST JSON to an @action and return its JSON result. Throws on non-2xx with
 * the server-provided error message. Intended for use from islands; plain
 * <form action=…> posts also work for progressive enhancement.
 */
export async function callAction<T = unknown>(
  url: string,
  data?: unknown,
  options: ICallActionOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: options.signal,
  })
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = parsed?.error?.message ?? `Action failed with status ${response.status}`
    throw new Error(message)
  }
  return parsed as T
}
