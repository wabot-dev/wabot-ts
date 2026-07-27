import test from 'node:test'
import assert from 'node:assert/strict'

import { InMemoryRateLimiter } from './InMemoryRateLimiter'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test.describe('InMemoryRateLimiter', () => {
  test('allows up to the limit, then denies', async () => {
    const rl = new InMemoryRateLimiter()
    const r1 = await rl.hit('k', { limit: 3, windowSeconds: 60 })
    const r2 = await rl.hit('k', { limit: 3, windowSeconds: 60 })
    const r3 = await rl.hit('k', { limit: 3, windowSeconds: 60 })
    const r4 = await rl.hit('k', { limit: 3, windowSeconds: 60 })

    assert.deepEqual(
      [r1, r2, r3, r4].map((r) => r.allowed),
      [true, true, true, false],
    )
    assert.deepEqual(
      [r1, r2, r3, r4].map((r) => r.remaining),
      [2, 1, 0, 0],
    )
    assert.ok(r1.resetAt.getTime() > Date.now())
  })

  test('different keys have independent budgets', async () => {
    const rl = new InMemoryRateLimiter()
    assert.equal((await rl.hit('a', { limit: 1, windowSeconds: 60 })).allowed, true)
    assert.equal((await rl.hit('a', { limit: 1, windowSeconds: 60 })).allowed, false)
    assert.equal((await rl.hit('b', { limit: 1, windowSeconds: 60 })).allowed, true)
  })

  test('the window resets after it elapses', async () => {
    const rl = new InMemoryRateLimiter()
    assert.equal((await rl.hit('k', { limit: 1, windowSeconds: 0.05 })).allowed, true)
    assert.equal((await rl.hit('k', { limit: 1, windowSeconds: 0.05 })).allowed, false)
    await wait(70)
    assert.equal((await rl.hit('k', { limit: 1, windowSeconds: 0.05 })).allowed, true)
  })
})
