import test from 'node:test'
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'

import { clearOnDetach, runDetached } from './runDetached'

const first = new AsyncLocalStorage<string>()
const second = new AsyncLocalStorage<string>()
clearOnDetach((fn) => first.run('', fn))
clearOnDetach((fn) => second.exit(fn))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('clears every registered store, and leaves the caller its own', async () => {
  await first.run('caller', () =>
    second.run('caller', async () => {
      const seen = await runDetached(async () => {
        await sleep(1)
        return [first.getStore(), second.getStore()]
      })
      assert.deepEqual(seen, ['', undefined])
      assert.equal(first.getStore(), 'caller')
      assert.equal(second.getStore(), 'caller')
    }),
  )
})

test('work it starts without awaiting stays cleared after the caller moves on', async () => {
  let later: Promise<string | undefined> | null = null
  await first.run('caller', async () => {
    later = runDetached(() => sleep(5).then(() => first.getStore()))
  })
  assert.equal(await later, '')
})

test('state the detached work sets up is its own', async () => {
  await runDetached(() =>
    first.run('detached', async () => {
      await sleep(1)
      assert.equal(first.getStore(), 'detached')
    }),
  )
  assert.equal(first.getStore(), undefined)
})
