import test from 'node:test'
import assert from 'node:assert/strict'

import { createUiHarness } from '@/testing'
import { MonitorController } from './MonitorController'
import { MonitorStatsService } from './MonitorStatsService'
import type { IMonitorDashboard } from './IMonitorStats'

const KEY = 'test-monitor-key'

// Minimal fixture: the test only asserts the title, conversations.total (1234),
// an error command (sync-leads) and a cron name (nightly).
const dashboard: IMonitorDashboard = {
  conversations: { total: 1234, byType: [], byChannel: [], new24h: 0, new7d: 0 },
  messages: { total: 0, byType: [], last24h: 0 },
  errors: {
    total: 0,
    last24h: 0,
    recent: [{ id: 'e1', commandName: 'sync-leads', message: 'db timeout', time: null, stack: null }],
    byCommand: [],
  },
  jobs: { running: 0, pending: 0, succeeded: 0, failed: 0 },
  cron: [
    { name: 'nightly', commandName: 'sync', cron: '0 0 * * *', enabled: true, lastRunAt: null, nextRunAt: null },
  ],
  generatedAt: 1700000000000,
}

const fakeService = { getDashboard: async () => dashboard } as unknown as MonitorStatsService

let harness: Awaited<ReturnType<typeof createUiHarness>>

test.before(async () => {
  process.env.MONITOR_API_KEY = KEY
  harness = await createUiHarness({
    controllers: [MonitorController],
    register: [[MonitorStatsService, fakeService]],
  })
})

test.after(async () => {
  delete process.env.MONITOR_API_KEY
  await harness.close()
})

test('GET /monitor sin key → 401', async () => {
  const res = await harness.get('/monitor')
  assert.equal(res.status, 401)
})

test('GET /monitor con ?key válida → 200 y renderiza las métricas', async () => {
  const res = await harness.get('/monitor', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /Wabot Monitor/)
  assert.match(res.text, /1,234/) // conversations.total, formatted
  assert.match(res.text, /sync-leads/) // error command
  assert.match(res.text, /nightly/) // cron name
})
