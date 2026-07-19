import test from 'node:test'
import assert from 'node:assert/strict'

import { InMemoryIdempotency } from './InMemoryIdempotency'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test.describe('InMemoryIdempotency', () => {
  test('first sight is not a duplicate; the second within TTL is', async () => {
    const idem = new InMemoryIdempotency()
    assert.equal(await idem.alreadyProcessed('k1', 60), false)
    assert.equal(await idem.alreadyProcessed('k1', 60), true)
  })

  test('different keys are independent', async () => {
    const idem = new InMemoryIdempotency()
    assert.equal(await idem.alreadyProcessed('a', 60), false)
    assert.equal(await idem.alreadyProcessed('b', 60), false)
  })

  test('forget() lets a key be processed again', async () => {
    const idem = new InMemoryIdempotency()
    await idem.alreadyProcessed('k', 60)
    await idem.forget('k')
    assert.equal(await idem.alreadyProcessed('k', 60), false)
  })

  test('a key expires after its TTL', async () => {
    const idem = new InMemoryIdempotency()
    assert.equal(await idem.alreadyProcessed('k', 0.05), false)
    assert.equal(await idem.alreadyProcessed('k', 0.05), true)
    await wait(70)
    assert.equal(await idem.alreadyProcessed('k', 0.05), false)
  })

  test('runOnce runs fn the first time and skips duplicates', async () => {
    const idem = new InMemoryIdempotency()
    let runs = 0
    assert.equal(await idem.runOnce('k', 60, async () => void runs++), true)
    assert.equal(await idem.runOnce('k', 60, async () => void runs++), false)
    assert.equal(runs, 1)
  })

  test('runOnce releases the key when fn throws so a retry reprocesses', async () => {
    const idem = new InMemoryIdempotency()
    await assert.rejects(() =>
      idem.runOnce('k', 60, async () => {
        throw new Error('boom')
      }),
    )
    // key was released → a retry is not treated as a duplicate
    let ran = false
    assert.equal(await idem.runOnce('k', 60, async () => void (ran = true)), true)
    assert.equal(ran, true)
  })
})
