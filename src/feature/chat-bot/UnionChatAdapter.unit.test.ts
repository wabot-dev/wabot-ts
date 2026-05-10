import test from 'node:test'
import assert from 'node:assert/strict'
import { ChatAdapterRegistry } from './ChatAdapterRegistry'
import { IChatAdapter, IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from './IChatAdapter'
import { UnionChatAdapter } from './UnionChatAdapter'

interface IFakeAdapterCall {
  modelNames: string[]
}

class FakeAdapter implements IChatAdapter {
  public calls: IFakeAdapterCall[] = []
  private behavior: () => Promise<IChatAdapterNextItemsRes> = () => okResponse()

  setOk() {
    this.behavior = () => okResponse()
    return this
  }

  setError(err: unknown) {
    this.behavior = () => {
      throw err
    }
    return this
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    this.calls.push({ modelNames: req.models.map((m) => m.model) })
    return this.behavior()
  }
}

function okResponse(): Promise<IChatAdapterNextItemsRes> {
  return Promise.resolve({
    nextItems: [{ type: 'botMessage', botMessage: { text: 'ok' } }],
    usage: { inputTokens: 1, outputTokens: 1 },
  })
}

function buildReq(models: { provider?: string; model: string }[]): IChatAdapterNextItemsReq {
  return {
    models,
    systemPrompt: '',
    tools: [],
    prevItems: [],
  }
}

function setup() {
  const registry = new ChatAdapterRegistry()
  const adapter = new UnionChatAdapter(registry)
  return { registry, adapter }
}

test.describe('UnionChatAdapter', () => {
  test('throws when no adapters registered', async () => {
    const { adapter } = setup()
    await assert.rejects(
      adapter.nextItems(buildReq([{ provider: 'openai', model: 'gpt-4' }])),
      /No chat adapters registered/,
    )
  })

  test('throws when models list is empty', async () => {
    const { registry, adapter } = setup()
    registry.register('openai', new FakeAdapter().setOk())
    await assert.rejects(adapter.nextItems(buildReq([])), /empty models list/)
  })

  test('routes a single-provider list to the matching adapter', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setOk()
    registry.register('openai', openai)

    const res = await adapter.nextItems(
      buildReq([
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'openai', model: 'gpt-4o' },
      ]),
    )

    assert.equal(openai.calls.length, 1)
    assert.deepEqual(openai.calls[0].modelNames, ['gpt-4', 'gpt-4o'])
    assert.equal(res.nextItems.length, 1)
  })

  test('groups consecutive same-provider entries into one adapter call', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setOk()
    const anthropic = new FakeAdapter().setOk()
    registry.register('openai', openai)
    registry.register('anthropic', anthropic)

    await adapter.nextItems(
      buildReq([
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'anthropic', model: 'claude' },
      ]),
    )

    // openai succeeds first, anthropic never called
    assert.equal(openai.calls.length, 1)
    assert.deepEqual(openai.calls[0].modelNames, ['gpt-4', 'gpt-4o'])
    assert.equal(anthropic.calls.length, 0)
  })

  test('non-consecutive same-provider entries form separate groups', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setError({ status: 503 })
    const anthropic = new FakeAdapter().setError({ status: 503 })
    registry.register('openai', openai)
    registry.register('anthropic', anthropic)

    await assert.rejects(
      adapter.nextItems(
        buildReq([
          { provider: 'openai', model: 'a' },
          { provider: 'anthropic', model: 'b' },
          { provider: 'openai', model: 'c' },
        ]),
      ),
    )

    // openai called twice (two non-consecutive groups), each with 1 entry
    assert.equal(openai.calls.length, 2)
    assert.deepEqual(openai.calls[0].modelNames, ['a'])
    assert.deepEqual(openai.calls[1].modelNames, ['c'])
    assert.equal(anthropic.calls.length, 1)
    assert.deepEqual(anthropic.calls[0].modelNames, ['b'])
  })

  test('falls through to next group on retryable error', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setError({ status: 503 })
    const anthropic = new FakeAdapter().setOk()
    registry.register('openai', openai)
    registry.register('anthropic', anthropic)

    const res = await adapter.nextItems(
      buildReq([
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'anthropic', model: 'claude' },
      ]),
    )

    assert.equal(openai.calls.length, 1)
    assert.equal(anthropic.calls.length, 1)
    assert.equal(res.nextItems.length, 1)
  })

  test('propagates non-retryable error immediately', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setError({ status: 401 })
    const anthropic = new FakeAdapter().setOk()
    registry.register('openai', openai)
    registry.register('anthropic', anthropic)

    await assert.rejects(
      adapter.nextItems(
        buildReq([
          { provider: 'openai', model: 'gpt-4' },
          { provider: 'anthropic', model: 'claude' },
        ]),
      ),
      (err: unknown) => (err as { status?: number }).status === 401,
    )

    assert.equal(openai.calls.length, 1)
    assert.equal(anthropic.calls.length, 0, 'anthropic should NOT be tried on 401')
  })

  test('skips group when adapter not registered for its provider', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setOk()
    registry.register('openai', openai)
    // 'anthropic' is NOT registered

    const res = await adapter.nextItems(
      buildReq([
        { provider: 'anthropic', model: 'claude' },
        { provider: 'openai', model: 'gpt-4' },
      ]),
    )

    assert.equal(openai.calls.length, 1)
    assert.deepEqual(openai.calls[0].modelNames, ['gpt-4'])
    assert.equal(res.nextItems.length, 1)
  })

  test('refs without provider use the default (first registered)', async () => {
    const { registry, adapter } = setup()
    const first = new FakeAdapter().setOk()
    const second = new FakeAdapter().setOk()
    registry.register('openai', first) // first registered → default
    registry.register('anthropic', second)

    await adapter.nextItems(buildReq([{ model: 'gpt-4' }]))

    assert.equal(first.calls.length, 1)
    assert.equal(second.calls.length, 0)
  })

  test('returns first successful response without continuing', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setOk()
    const anthropic = new FakeAdapter().setOk()
    registry.register('openai', openai)
    registry.register('anthropic', anthropic)

    await adapter.nextItems(
      buildReq([
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'anthropic', model: 'claude' },
      ]),
    )

    assert.equal(openai.calls.length, 1)
    assert.equal(anthropic.calls.length, 0)
  })

  test('throws lastError when all groups fail with retryable errors', async () => {
    const { registry, adapter } = setup()
    const openai = new FakeAdapter().setError({ status: 503, marker: 'openai-503' })
    const anthropic = new FakeAdapter().setError({ status: 500, marker: 'anthropic-500' })
    registry.register('openai', openai)
    registry.register('anthropic', anthropic)

    await assert.rejects(
      adapter.nextItems(
        buildReq([
          { provider: 'openai', model: 'gpt-4' },
          { provider: 'anthropic', model: 'claude' },
        ]),
      ),
      (err: unknown) => (err as { marker?: string }).marker === 'anthropic-500',
    )
  })
})
