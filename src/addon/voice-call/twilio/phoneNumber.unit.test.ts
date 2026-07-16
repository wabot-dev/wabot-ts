import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeE164 } from './phoneNumber'

test.describe('normalizeE164', () => {
  test('strips formatting from an E.164 number', () => {
    assert.equal(normalizeE164('+57 300 111 2233'), '+573001112233')
  })

  test('treats every country the same — no default country is added', () => {
    assert.equal(normalizeE164('+1 (202) 555-0100'), '+12025550100')
    assert.equal(normalizeE164('+44 20 7946 0958'), '+442079460958')
  })

  test('keeps an already-clean number unchanged', () => {
    assert.equal(normalizeE164('+573001112233'), '+573001112233')
  })

  test('does not expand a bare local number to any country', () => {
    // No country code in, no country code out — the digits are used as given.
    assert.equal(normalizeE164('3001112233'), '+3001112233')
  })

  test('returns empty string when there are no digits', () => {
    assert.equal(normalizeE164('  '), '')
  })
})
