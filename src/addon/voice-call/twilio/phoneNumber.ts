/**
 * Normalizes a phone number to E.164, defaulting to Colombia (+57) when no
 * country code is present. Colombian numbers are 10 digits (mobile 3XX,
 * fixed-line 60X).
 */
export function toE164Colombia(input: string): string {
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (hasPlus) return `+${digits}`
  if (digits.startsWith('57') && digits.length >= 12) return `+${digits}`
  if (digits.length === 10) return `+57${digits}`
  return `+${digits}`
}

/**
 * Country-agnostic E.164 normalization: strips formatting and returns the
 * digits with a leading `+`. Use it to compare caller-ID (`from`) numbers that
 * may belong to any country/account, without assuming Colombia.
 */
export function normalizeE164(input: string): string {
  const digits = input.trim().replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}
