import test from 'node:test'
import assert from 'node:assert/strict'
import { toE164Colombia } from './phoneNumber'

test.describe('toE164Colombia', () => {
  test('adds +57 to a bare 10-digit Colombian mobile', () => {
    assert.equal(toE164Colombia('3001112233'), '+573001112233')
  })

  test('adds +57 to a 10-digit fixed line', () => {
    assert.equal(toE164Colombia('(601) 234 5678'), '+576012345678')
  })

  test('keeps an existing +57 number', () => {
    assert.equal(toE164Colombia('+57 300 111 2233'), '+573001112233')
  })

  test('treats a 57-prefixed 12-digit number as Colombian', () => {
    assert.equal(toE164Colombia('57 300 111 2233'), '+573001112233')
  })

  test('preserves an explicit foreign country code', () => {
    assert.equal(toE164Colombia('+1 202 555 0100'), '+12025550100')
  })
})
