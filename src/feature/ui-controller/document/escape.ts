const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escape text for safe interpolation into HTML element content. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c])
}

/** Escape a value for safe interpolation into a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return escapeHtml(value)
}
