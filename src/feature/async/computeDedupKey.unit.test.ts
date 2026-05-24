import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDedupKey } from './computeDedupKey'

test.describe('computeDedupKey', () => {
  test('is deterministic for the same input', () => {
    const a = computeDedupKey({ userId: 'u1', amount: 100 })
    const b = computeDedupKey({ userId: 'u1', amount: 100 })
    assert.equal(a, b)
  })

  test('is order-independent across object keys', () => {
    const a = computeDedupKey({ userId: 'u1', amount: 100 })
    const b = computeDedupKey({ amount: 100, userId: 'u1' })
    assert.equal(a, b)
  })

  test('is order-independent across nested object keys', () => {
    const a = computeDedupKey({ user: { id: 'u1', name: 'a' }, amount: 100 })
    const b = computeDedupKey({ amount: 100, user: { name: 'a', id: 'u1' } })
    assert.equal(a, b)
  })

  test('differs when values differ', () => {
    const a = computeDedupKey({ userId: 'u1', amount: 100 })
    const b = computeDedupKey({ userId: 'u1', amount: 200 })
    assert.notEqual(a, b)
  })

  test('respects array order', () => {
    const a = computeDedupKey({ items: [1, 2, 3] })
    const b = computeDedupKey({ items: [3, 2, 1] })
    assert.notEqual(a, b)
  })

  test('treats undefined fields as absent', () => {
    const a = computeDedupKey({ userId: 'u1', amount: 100, note: undefined })
    const b = computeDedupKey({ userId: 'u1', amount: 100 })
    assert.equal(a, b)
  })

  test('handles null and undefined commandData', () => {
    const a = computeDedupKey(undefined)
    const b = computeDedupKey(null)
    assert.equal(typeof a, 'string')
    assert.equal(a.length, 64)
    assert.equal(a, b)
  })
})
