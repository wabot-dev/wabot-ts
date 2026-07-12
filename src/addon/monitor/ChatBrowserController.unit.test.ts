import test from 'node:test'
import assert from 'node:assert/strict'

import { createUiHarness } from '@/testing'
import { ChatBrowserController } from './ChatBrowserController'
import { ChatBrowserRepository } from './ChatBrowserRepository'
import type { IChatSummary, IChatThreadItem } from './IChatsBrowser'

const KEY = 'test-monitor-key'

const chats: IChatSummary[] = [
  {
    id: 'chat-1',
    type: 'PRIVATE',
    channels: ['whatsapp'],
    associations: [],
    createdAt: 0,
    lastActivity: 1700000000000,
    msgCount: 3,
  },
]

const thread: IChatThreadItem[] = [
  { id: 'm1', type: 'humanMessage', createdAt: 1700000000000, data: { type: 'humanMessage', humanMessage: { text: 'hola' } } },
  {
    id: 'm2',
    type: 'functionCall',
    createdAt: 1700000001000,
    data: {
      type: 'functionCall',
      functionCall: { id: 'f1', name: 'createEvent', arguments: '{"title":"x"}', result: '{"ok":true}' },
    },
  },
  { id: 'm3', type: 'botMessage', createdAt: 1700000002000, data: { type: 'botMessage', botMessage: { text: 'agendado' } } },
]

const fakeBrowser = {
  listChats: async () => chats,
  countChats: async () => 1,
  chatHeader: async (id: string) => chats.find((c) => c.id === id) ?? null,
  chatThread: async (id: string) => (id === 'chat-1' ? thread : []),
} as unknown as ChatBrowserRepository

let harness: Awaited<ReturnType<typeof createUiHarness>>

test.before(async () => {
  process.env.MONITOR_API_KEY = KEY
  harness = await createUiHarness({
    controllers: [ChatBrowserController],
    register: [[ChatBrowserRepository, fakeBrowser]],
  })
})

test.after(async () => {
  delete process.env.MONITOR_API_KEY
  await harness.close()
})

test('GET /monitor/chats sin key → 401', async () => {
  assert.equal((await harness.get('/monitor/chats')).status, 401)
})

test('GET /monitor/chats?key → 200 y lista conversaciones', async () => {
  const res = await harness.get('/monitor/chats', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /chat-1/)
  assert.match(res.text, /whatsapp/)
})

test('GET /monitor/chats/chat-1?key → 200 y renderiza el hilo con function call', async () => {
  const res = await harness.get('/monitor/chats/chat-1', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /hola/)
  assert.match(res.text, /createEvent/)
  assert.match(res.text, /agendado/)
})

test('GET /monitor/chats/inexistente?key → 200 con "Chat no encontrado"', async () => {
  const res = await harness.get('/monitor/chats/inexistente', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /Chat no encontrado/)
})
