import test from 'node:test'
import assert from 'node:assert/strict'

import { addLogContext, getLogContext, runWithLogContext } from './logContext'

test.describe('logContext', () => {
  test('there is no context outside runWithLogContext', () => {
    assert.equal(getLogContext(), undefined)
  })

  test('generates a requestId and carries the provided fields', () => {
    runWithLogContext({ channel: 'telegram' }, () => {
      const ctx = getLogContext()
      assert.equal(ctx?.channel, 'telegram')
      assert.ok(typeof ctx?.requestId === 'string' && ctx.requestId.length > 0)
    })
  })

  test('preserves an explicit requestId', () => {
    runWithLogContext({ requestId: 'fixed' }, () => {
      assert.equal(getLogContext()?.requestId, 'fixed')
    })
  })

  test('addLogContext merges into the current context', () => {
    runWithLogContext({ requestId: 'r' }, () => {
      addLogContext({ chatId: 'c1' })
      assert.equal(getLogContext()?.chatId, 'c1')
      assert.equal(getLogContext()?.requestId, 'r')
    })
  })

  test('addLogContext outside a scope is a no-op', () => {
    addLogContext({ x: 1 })
    assert.equal(getLogContext(), undefined)
  })

  test('propagates across awaits', async () => {
    await runWithLogContext({ requestId: 'async' }, async () => {
      await new Promise((r) => setTimeout(r, 5))
      assert.equal(getLogContext()?.requestId, 'async')
    })
  })

  test('nested scopes are isolated', () => {
    runWithLogContext({ requestId: 'outer' }, () => {
      runWithLogContext({ requestId: 'inner' }, () => {
        assert.equal(getLogContext()?.requestId, 'inner')
      })
      assert.equal(getLogContext()?.requestId, 'outer')
    })
  })
})
