import test from 'node:test'
import assert from 'node:assert/strict'

import { createUiHarness } from '@/testing'
import { MonitorController } from './MonitorController'
import { MonitorStatsRepository } from './MonitorStatsRepository'
import { MonitorStatsService } from './MonitorStatsService'
import type { IMonitorDashboard } from './IMonitorStats'

const KEY = 'test-monitor-key'

const dashboard: IMonitorDashboard = {
  conversations: {
    total: 1234,
    byType: [{ name: 'PRIVATE', count: 1000 }],
    byChannel: [{ name: 'whatsapp', count: 900 }],
    new24h: 12,
    new7d: 40,
  },
  messages: {
    total: 9999,
    byType: [
      { name: 'humanMessage', count: 5000 },
      { name: 'botMessage', count: 4999 },
    ],
    last24h: 77,
  },
  errors: { total: 3, last24h: 1, recent: [], byCommand: [{ name: 'sync-leads', count: 3 }] },
  jobs: { running: 2, pending: 5, succeeded: 800, failed: 3 },
  cron: [
    { name: 'nightly', commandName: 'sync', cron: '0 0 * * *', enabled: true, lastRunAt: null, nextRunAt: null },
  ],
  generatedAt: 1700000000000,
}

const fakeService = { getDashboard: async () => dashboard } as unknown as MonitorStatsService
// The hub view only touches the service; the repo is injected for the list views
// (not exercised here) — register an empty stub so resolution succeeds.
const fakeRepo = {} as unknown as MonitorStatsRepository

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

test('GET /monitor sin key → 401', async () => {
  assert.equal((await harness.get('/monitor')).status, 401)
})

test('GET /monitor?key → 200 y renderiza el hub', async () => {
  const res = await harness.get('/monitor', { query: { key: KEY } })
  assert.equal(res.status, 200)
  assert.match(res.text, /Overview/)
  assert.match(res.text, /1,234/) // conversations.total
  assert.match(res.text, /nightly/) // cron
  assert.match(res.text, /sync-leads/) // errors.byCommand
})
