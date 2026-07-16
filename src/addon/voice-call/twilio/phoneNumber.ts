/**
 * Normalizes a phone number to E.164 without assuming any country: strips
 * formatting (spaces, dashes, parentheses) and returns the remaining digits with
 * a single leading `+`. The caller must supply the country code — a bare local
 * number is left as-is (digits only), never expanded to a default country.
 *
 * Use it for every number the framework handles — caller-ID (`from`) and
 * recipient (`to`) alike — so all countries get identical treatment.
 */
export function normalizeE164(input: string): string {
  const digits = input.trim().replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}
