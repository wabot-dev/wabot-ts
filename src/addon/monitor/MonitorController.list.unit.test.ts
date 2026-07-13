import test from 'node:test'
import assert from 'node:assert/strict'

import { createUiHarness } from '@/testing'
import { MonitorController } from './MonitorController'
import { MonitorStatsRepository } from './MonitorStatsRepository'
import { MonitorStatsService } from './MonitorStatsService'
import type { IErrorRow, IJobRow, IMessageRow } from './IMonitorStats'

const KEY = 'test-monitor-key'

const errors: IErrorRow[] = [
  { id: 'e1', commandName: 'sync-leads', message: 'db timeout', time: 1700000000000, stack: null },
]
const jobs: IJobRow[] = [
  {
    id: 'j1',
    commandName: 'ingest',
    state: 'failed',
    scheduledAt: null,
    startedAt: null,
    successAt: null,
    failedAt: 1700000000000,
    errorMessage: 'boom',
  },
]
const messages: IMessageRow[] = [
  { id: 'm1', chatId: 'chat-1', type: 'humanMessage', text: 'hola', createdAt: 1700000000000 },
]

// Tracks the filter the handler passed through, so the filter happy-path tests
// can assert the repo actually received ?state / ?type.
let lastJobState: string | undefined
let lastMsgType: string | undefined

const fakeRepo = {
  listErrors: async () => errors,
  countErrors: async () => errors.length,
  listJobs: async (state?: string) => {
    lastJobState = state
    return jobs
  },
  countJobs: async () => jobs.length,
  listMessages: async (type?: string) => {
    lastMsgType = type
    return messages
  },
  countMessages: async () => messages.length,
} as unknown as MonitorStatsRepository

// The list views don't touch the service, but the controller needs it to resolve.
const fakeService = { getDashboard: async () => ({}) } as unknown as MonitorStatsService

let harness: Awaited<ReturnType<typeof createUiHarness>>

test.before(async () => {
  process.env.MONITOR_API_KEY = KEY
  harness = await createUiHarness({
    controllers: [MonitorController],
    register: [
      [MonitorStatsService, fakeService],
      [MonitorStatsRepository, fakeRepo],
    ],
  })
})

test.after(async () => {
  delete process.env.MONITOR_API_KEY
  await harness.close()
})

test('GET /monitor/errors?key → 200 y renderiza la lista de errores', async () => {
  const res = await harness.get('/monitor/errors', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /sync-leads/)
  assert.match(res.text, /db timeout/)
})

test('GET /monitor/jobs?key → 200 y renderiza la lista de jobs', async () => {
  const res = await harness.get('/monitor/jobs', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /j1/)
  assert.match(res.text, /failed/)
})

test('GET /monitor/messages?key → 200 y renderiza la lista de mensajes', async () => {
  const res = await harness.get('/monitor/messages', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /chat-1/)
  assert.match(res.text, /hola/)
})

test('GET /monitor/jobs?state=failed → 200 y pasa el filtro al repo', async () => {
  lastJobState = undefined
  const res = await harness.get('/monitor/jobs', { query: { key: KEY, state: 'failed' } })
  assert.equal(res.status, 200)
  assert.equal(lastJobState, 'failed')
})

test('GET /monitor/messages?type=humanMessage → 200 y pasa el filtro al repo', async () => {
  lastMsgType = undefined
  const res = await harness.get('/monitor/messages', { query: { key: KEY, type: 'humanMessage' } })
  assert.equal(res.status, 200)
  assert.equal(lastMsgType, 'humanMessage')
})
