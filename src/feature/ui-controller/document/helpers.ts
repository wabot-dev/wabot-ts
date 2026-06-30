export const REDIRECT_MARKER = Symbol.for('wabot.ui.redirect')

export interface UiRedirect {
  readonly [REDIRECT_MARKER]: true
  location: string
  status: number
}

/**
 * Return this from a @view or @action to send an HTTP redirect instead of
 * rendering. Used for the post/redirect/get pattern after form actions.
 */
export function redirect(location: string, status = 302): UiRedirect {
  return { [REDIRECT_MARKER]: true, location, status }
}

export function isRedirect(value: unknown): value is UiRedirect {
  return typeof value === 'object' && value != null && (value as any)[REDIRECT_MARKER] === true
}
