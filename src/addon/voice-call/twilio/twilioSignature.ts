import crypto from 'node:crypto'

/**
 * Validates Twilio's `X-Twilio-Signature` for a webhook request.
 *
 * Twilio computes the signature as base64(HMAC-SHA1(authToken, data)), where
 * `data` is the exact request URL (including any query string) followed by the
 * POST parameters sorted by key and concatenated as `key + value`. See
 * https://www.twilio.com/docs/usage/security#validating-requests
 *
 * @param authToken  The auth token of the account Twilio signed with.
 * @param signature  The value of the `X-Twilio-Signature` header.
 * @param url        The full URL Twilio requested (origin + path + query).
 * @param params     The POST body parameters (application/x-www-form-urlencoded).
 */
export function isValidTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!authToken || !signature) return false

  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join('')

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64')

  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signature)
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)
}
