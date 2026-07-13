import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidTwilioSignature } from './twilioSignature'

// Inputs from Twilio's request-validation docs. The string signed is the URL
// followed by params sorted by key as `key+value` with no separators, i.e.
// "…?foo=1&bar=2" + "CallSidCA1234567890ABCDE" + "Caller+14158675309" + …
// then base64(HMAC-SHA1(authToken, that)).
const URL = 'https://mycompany.com/myapp.php?foo=1&bar=2'
const PARAMS = {
  CallSid: 'CA1234567890ABCDE',
  Caller: '+14158675309',
  Digits: '1234',
  From: '+14158675309',
  To: '+18005551212',
}
const TOKEN = '12345'
const VALID_SIGNATURE = 'RSOYDt4T1cUTdK1PDd93/VVr8B8='

test.describe('isValidTwilioSignature', () => {
  test('accepts a correctly signed request', () => {
    assert.equal(isValidTwilioSignature(TOKEN, VALID_SIGNATURE, URL, PARAMS), true)
  })

  test('rejects a tampered signature', () => {
    assert.equal(isValidTwilioSignature(TOKEN, 'AAAAAAAAAAAAAAAAAAAAAAAAAAA=', URL, PARAMS), false)
  })

  test('rejects the wrong auth token', () => {
    assert.equal(isValidTwilioSignature('bad-token', VALID_SIGNATURE, URL, PARAMS), false)
  })

  test('rejects a changed parameter', () => {
    assert.equal(
      isValidTwilioSignature(TOKEN, VALID_SIGNATURE, URL, { ...PARAMS, Digits: '9999' }),
      false,
    )
  })

  test('rejects when signature or token is missing', () => {
    assert.equal(isValidTwilioSignature(TOKEN, undefined, URL, PARAMS), false)
    assert.equal(isValidTwilioSignature('', VALID_SIGNATURE, URL, PARAMS), false)
  })
})
