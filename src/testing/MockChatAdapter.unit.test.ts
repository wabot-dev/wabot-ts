import assert from 'node:assert/strict'
import test from 'node:test'

import { MockChatAdapter } from './MockChatAdapter'

const baseReq = {
  models: [{ model: 'test-model' }],
  systemPrompt: 'Act as a Bot',
  tools: [],
  prevItems: [],
}

test('consumes scripted responses in order', async () => {
  const mock = new MockChatAdapter()
  mock.reply('first').reply('second')

  const first = await mock.nextItems(baseReq)
  const second = await mock.nextItems(baseReq)

  assert.equal(first.nextItems[0].botMessage?.text, 'first')
  assert.equal(second.nextItems[0].botMessage?.text, 'second')
  assert.equal(mock.pendingResponses(), 0)
})

test('callTool queues a function call with JSON arguments', async () => {
  const mock = new MockChatAdapter()
  mock.callTool('createEvent', { title: 'Demo' })

  const { nextItems } = await mock.nextItems(baseReq)

  assert.equal(nextItems[0].type, 'functionCall')
  assert.equal(nextItems[0].functionCall?.name, 'createEvent')
  assert.deepEqual(JSON.parse(nextItems[0].functionCall?.arguments ?? '{}'), { title: 'Demo' })
  assert.ok(nextItems[0].functionCall?.id)
})

test('enqueue accepts a dynamic response based on the request', async () => {
  const mock = new MockChatAdapter()
  mock.enqueue((req) => [
    { type: 'botMessage', botMessage: { text: `prompt was: ${req.systemPrompt}` } },
  ])

  const { nextItems } = await mock.nextItems(baseReq)

  assert.equal(nextItems[0].botMessage?.text, 'prompt was: Act as a Bot')
})

test('throws a clear error when no response is scripted', async () => {
  const mock = new MockChatAdapter()
  await assert.rejects(() => mock.nextItems(baseReq), /no scripted response/)
})

test('fallbackReply answers when the queue is empty', async () => {
  const mock = new MockChatAdapter({ fallbackReply: 'ok' })

  const { nextItems } = await mock.nextItems(baseReq)

  assert.equal(nextItems[0].botMessage?.text, 'ok')
})

test('records every request and reports a valid usage', async () => {
  const mock = new MockChatAdapter({ fallbackReply: 'ok' })

  const { usage } = await mock.nextItems({
    ...baseReq,
    prevItems: [{ type: 'humanMessage', humanMessage: { text: 'hola' } }],
  })

  assert.equal(mock.requests.length, 1)
  assert.equal(mock.lastRequest?.prevItems[0]?.humanMessage?.text, 'hola')
  assert.equal(usage.provider, 'mock')
  assert.equal(usage.model, 'test-model')
  assert.ok(usage.inputTokens > 0)
  assert.ok(usage.outputTokens > 0)
})
