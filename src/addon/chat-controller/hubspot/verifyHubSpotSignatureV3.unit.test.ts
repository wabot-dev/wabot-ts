import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { Signature } from '@hubspot/api-client'
import { verifyHubSpotSignatureV3 } from './verifyHubSpotSignatureV3'

const SECRET = 'test-client-secret'
const METHOD = 'POST'
const URL = '/hubspot/webhook/account-a'
const BODY = '{"subscriptionType":"conversation.creation"}'

function nowMs(): number {
  return Date.now()
}

function signV3(opts: {
  method: string
  url: string
  body: string
  secret: string
  timestamp: number
}): string {
  // Mirrors SDK Signature.getSignature('v3'): HMAC-SHA256(secret, `${method}${url}${body}${timestamp}`) base64
  const source = `${opts.method}${opts.url}${opts.body}${opts.timestamp}`
  return createHmac('sha256', opts.secret).update(source).digest('base64')
}

test.describe('verifyHubSpotSignatureV3', () => {
  test('returns true for a valid signature with a fresh timestamp', () => {
    const timestamp = nowMs()
    const signature = signV3({ method: METHOD, url: URL, body: BODY, secret: SECRET, timestamp })

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: String(timestamp),
      signatureHeader: signature,
    })

    assert.equal(ok, true)
  })

  test('returns false when the signature has been tampered with', () => {
    const timestamp = nowMs()
    const signature = signV3({ method: METHOD, url: URL, body: BODY, secret: SECRET, timestamp })
    const tampered = signature.slice(0, -2) + (signature.endsWith('A') ? 'B=' : 'AA')

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: String(timestamp),
      signatureHeader: tampered,
    })

    assert.equal(ok, false)
  })

  test('returns false when the body has been tampered with', () => {
    const timestamp = nowMs()
    const signature = signV3({ method: METHOD, url: URL, body: BODY, secret: SECRET, timestamp })

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY + ' ', // tampered
      timestampHeader: String(timestamp),
      signatureHeader: signature,
    })

    assert.equal(ok, false)
  })

  test('returns false when the timestamp is outside the 5-minute window', () => {
    const stale = nowMs() - 6 * 60 * 1000 // 6 minutes ago
    const signature = signV3({
      method: METHOD,
      url: URL,
      body: BODY,
      secret: SECRET,
      timestamp: stale,
    })

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: String(stale),
      signatureHeader: signature,
    })

    assert.equal(ok, false)
  })

  test('returns false when the timestamp header is missing', () => {
    const signature = signV3({
      method: METHOD,
      url: URL,
      body: BODY,
      secret: SECRET,
      timestamp: nowMs(),
    })

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: '',
      signatureHeader: signature,
    })

    assert.equal(ok, false)
  })

  test('returns false when the signature header is missing', () => {
    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: String(nowMs()),
      signatureHeader: '',
    })

    assert.equal(ok, false)
  })

  test('returns false when the secret is empty', () => {
    const timestamp = nowMs()
    const signature = signV3({ method: METHOD, url: URL, body: BODY, secret: SECRET, timestamp })

    const ok = verifyHubSpotSignatureV3({
      secret: '',
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: String(timestamp),
      signatureHeader: signature,
    })

    assert.equal(ok, false)
  })

  test('returns false when the timestamp header is not a number', () => {
    const signature = signV3({
      method: METHOD,
      url: URL,
      body: BODY,
      secret: SECRET,
      timestamp: nowMs(),
    })

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: 'not-a-number',
      signatureHeader: signature,
    })

    assert.equal(ok, false)
  })

  test('matches the SDK Signature.getSignature output for v3', () => {
    const timestamp = nowMs()
    // Use the SDK's own getSignature to assert we agree on the wire format.
    const fromSdk = Signature.getSignature(METHOD, 'v3', {
      clientSecret: SECRET,
      requestBody: BODY,
      url: URL,
      timestamp,
      signature: 'unused-here',
    })

    const ok = verifyHubSpotSignatureV3({
      secret: SECRET,
      method: METHOD,
      url: URL,
      rawBody: BODY,
      timestampHeader: String(timestamp),
      signatureHeader: fromSdk,
    })

    assert.equal(ok, true)
  })
})
