import assert from 'node:assert/strict'
import test from 'node:test'

import { container } from '@/core/injection'
import { description } from '@/core/description'
import { tools } from '@/feature/tool'
import { IMindset, IMindsetDescription, IMindsetModels, MindsetCache } from '@/feature/mindset'
import { mindset } from './metadata'
import { createChatBotHarness } from '@/testing/chatBotHarness'

let describeCalls = 0
let modelsCalls = 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

abstract class CounterMindset implements IMindset {
  async describe(): Promise<IMindsetDescription> {
    describeCalls++
    return {
      identity: { name: 'C', language: 'english' },
      context: 'c',
      skills: 's',
      limits: 'l',
      workflow: 'w',
    }
  }
  async models(): Promise<IMindsetModels> {
    modelsCalls++
    return { llm: [{ model: 'mock-model' }] }
  }
}

@mindset({})
class UncachedMindset extends CounterMindset {}

@mindset({ cache: true })
class CachedMindset extends CounterMindset {}

@mindset({ cache: { revalidate: 1 } })
class TtlMindset extends CounterMindset {}

@tools()
class NoopTools {
  @description('Do nothing.')
  async noop() {
    return 'ok'
  }
}

@mindset({ tools: [NoopTools] })
class MemoMindset extends CounterMindset {}

async function runOnce(mindsetClass: any): Promise<void> {
  const harness = createChatBotHarness({ mindset: mindsetClass })
  harness.adapter.reply('hi there')
  await harness.send('hola')
}

test.beforeEach(() => {
  describeCalls = 0
  modelsCalls = 0
  container.resolve(MindsetCache).invalidateAll()
})

test.describe('mindset describe() caching', () => {
  test('without cache, every fresh operator recomputes describe()/models()', async () => {
    await runOnce(UncachedMindset)
    assert.equal(describeCalls, 1)
    await runOnce(UncachedMindset)
    assert.equal(describeCalls, 2)
    assert.equal(modelsCalls, 2)
  })

  test('cache: true computes once per class and reuses across operators', async () => {
    await runOnce(CachedMindset)
    await runOnce(CachedMindset)
    await runOnce(CachedMindset)
    assert.equal(describeCalls, 1)
    assert.equal(modelsCalls, 1)
  })

  test('a single message with tool round-trips loads the mindset once', async () => {
    const harness = createChatBotHarness({ mindset: MemoMindset })
    harness.adapter.callTool('noop').reply('done') // two model round-trips
    await harness.send('hola')
    assert.equal(describeCalls, 1) // memoized across the round-trips
  })

  test('revalidate recomputes after the TTL', async () => {
    await runOnce(TtlMindset)
    assert.equal(describeCalls, 1)
    await runOnce(TtlMindset) // still fresh
    assert.equal(describeCalls, 1)
    await sleep(1100) // past revalidate: 1s
    await runOnce(TtlMindset)
    assert.equal(describeCalls, 2)
  })

  test('MindsetCache.invalidate forces a recompute on next use', async () => {
    await runOnce(CachedMindset)
    assert.equal(describeCalls, 1)
    container.resolve(MindsetCache).invalidate(CachedMindset)
    await runOnce(CachedMindset)
    assert.equal(describeCalls, 2)
  })

  test('invalidateAll clears the cache', async () => {
    const cache = container.resolve(MindsetCache)
    await runOnce(CachedMindset)
    assert.deepEqual(cache.cachedClasses(), [CachedMindset])
    cache.invalidateAll()
    assert.equal(cache.cachedClasses().length, 0)
  })
})
