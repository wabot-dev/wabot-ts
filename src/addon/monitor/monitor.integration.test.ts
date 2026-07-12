import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

import { ChatBrowserRepository } from './ChatBrowserRepository'
import { MonitorStatsRepository } from './MonitorStatsRepository'

const url = process.env.DATABASE_URL

/**
 * Verifies the monitor's read-only SQL against a real PostgreSQL.
 *
 * DESTRUCTIVE: truncates wabot.{chat,chat_item,job,cron_job}. Run only against a
 * throwaway DB (e.g. the Neon wabot-monitor-test project). Skipped when
 * DATABASE_URL is unset, so `npm run test:units` is unaffected.
 *
 * Both repos share the same tables, so both cases live in ONE file — node runs
 * test files concurrently, and two files truncating the same tables would race.
 * Cases here run sequentially.
 */
let pool: Pool

test.before(async () => {
  if (url) pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
})

test.after(async () => {
  if (pool) await pool.end()
})

async function ensureTables() {
  await pool.query('CREATE SCHEMA IF NOT EXISTS wabot')
  await pool.query('CREATE TABLE IF NOT EXISTS wabot.chat (id TEXT PRIMARY KEY, created_at TIMESTAMP, data JSONB)')
  await pool.query('CREATE TABLE IF NOT EXISTS wabot.chat_item (id TEXT PRIMARY KEY, created_at TIMESTAMP, data JSONB, chat_id TEXT)')
  await pool.query('CREATE TABLE IF NOT EXISTS wabot.job (id TEXT PRIMARY KEY, created_at TIMESTAMP, data JSONB)')
  await pool.query('CREATE TABLE IF NOT EXISTS wabot.cron_job (id TEXT PRIMARY KEY, created_at TIMESTAMP, data JSONB)')
  await pool.query('ALTER TABLE wabot.chat_item ADD COLUMN IF NOT EXISTS chat_id TEXT')
}

async function truncateAll() {
  for (const t of ['chat_item', 'chat', 'job', 'cron_job']) await pool.query(`TRUNCATE wabot.${t}`)
}

async function insert(table: string, rows: { id: string; created_at: Date; data: object; chatId?: string }[]) {
  for (const r of rows) {
    if (r.chatId !== undefined) {
      await pool.query(`INSERT INTO wabot.${table} (id, created_at, data, chat_id) VALUES ($1,$2,$3,$4)`, [
        r.id,
        r.created_at,
        JSON.stringify(r.data),
        r.chatId,
      ])
    } else {
      await pool.query(`INSERT INTO wabot.${table} (id, created_at, data) VALUES ($1,$2,$3)`, [
        r.id,
        r.created_at,
        JSON.stringify(r.data),
      ])
    }
  }
}

test(
  'MonitorStatsRepository: los agregados matchean los datos sembrados',
  { skip: url ? undefined : 'DATABASE_URL not set' },
  async () => {
    const now = Date.now()
    const H = 3_600_000
    const D = 86_400_000
    const chats: any[] = []
    const messages: any[] = []
    const jobs: any[] = []
    const cron: any[] = []

    const channels: [string, number][] = [
      ['whatsapp', 8],
      ['telegram', 5],
      ['slack', 4],
      ['hubspot', 2],
      ['facebook', 1],
    ]
    let n = 0
    for (const [channel, count] of channels) {
      for (let k = 0; k < count; k++) {
        n++
        chats.push({
          id: `m-chat-${n}`,
          created_at: new Date(n <= 5 ? now - n * H : n <= 10 ? now - (2 + (n - 5)) * D : now - 30 * D),
          data: { type: n <= 14 ? 'PRIVATE' : 'GROUP', connections: [{ channelName: channel, id: `ext-${n}` }] },
        })
      }
    }
    const msgTypes: [string, number][] = [
      ['humanMessage', 30],
      ['botMessage', 30],
      ['functionCall', 10],
    ]
    let m = 0
    for (const [type, count] of msgTypes) {
      for (let k = 0; k < count; k++) {
        m++
        messages.push({ id: `m-msg-${m}`, created_at: new Date(m <= 15 ? now - m * (H / 2) : now - 20 * D), data: { type } })
      }
    }
    for (let i = 1; i <= 2; i++)
      jobs.push({ id: `m-run-${i}`, created_at: new Date(now - H), data: { commandName: 'ingest', scheduledAt: now - H, startedAt: now - H / 2 } })
    for (let i = 1; i <= 3; i++) jobs.push({ id: `m-pend-${i}`, created_at: new Date(now - H), data: { commandName: 'ingest', scheduledAt: now + H } })
    for (let i = 1; i <= 5; i++)
      jobs.push({ id: `m-ok-${i}`, created_at: new Date(now - 2 * D), data: { commandName: 'ingest', successAt: now - 2 * D } })
    const failedCmds = ['sync-leads', 'sync-leads', 'purge-old']
    for (let i = 0; i < 3; i++)
      jobs.push({
        id: `m-fail-${i + 1}`,
        created_at: new Date(now - 3 * D),
        data: { commandName: failedCmds[i], scheduledAt: now - 3 * D, startedAt: now - 3 * D, failedAt: now - 3 * D, ...(i < 2 ? { error: { time: now - i * H, message: 'x' } } : {}) },
      })
    const retryCmds = ['send-message', 'fetch-crm']
    for (let i = 0; i < 2; i++)
      jobs.push({ id: `m-retry-${i + 1}`, created_at: new Date(now - H), data: { commandName: retryCmds[i], scheduledAt: now + H, retryAt: now + H, error: { time: now - i * H, message: 'y' } } })
    cron.push({ id: 'm-cron-1', created_at: new Date(now - 10 * D), data: { name: 'nightly-sync', commandName: 'sync', cron: '0 2 * * *', enabled: true, lastRunAt: now - D, nextRunAt: now + H } })

    try {
      await ensureTables()
      await truncateAll()
      await insert('chat', chats)
      await insert('chat_item', messages)
      await insert('job', jobs)
      await insert('cron_job', cron)

      const repo = new MonitorStatsRepository(pool)
      const byName = (xs: { name: string; count: number }[]) => Object.fromEntries(xs.map((x) => [x.name, x.count]))

      assert.equal(await repo.countConversations(), 20)
      assert.equal(byName(await repo.conversationsByChannel()).whatsapp, 8)
      assert.equal(byName(await repo.conversationsByType()).PRIVATE, 14)
      assert.equal(await repo.countNewConversationsSince(new Date(now - 24 * H)), 5)
      assert.equal((await repo.messagesByType()).reduce((a, r) => a + r.count, 0), 70)
      assert.equal(await repo.countErrors(), 4)
      assert.equal(byName(await repo.errorsByCommand())['sync-leads'], 2)
      assert.deepEqual(await repo.jobCounts(), { running: 2, pending: 5, succeeded: 5, failed: 3 })
      assert.equal((await repo.listErrors(10, 0)).length, 4)
      assert.equal((await repo.listJobs('failed', 50, 0)).length, 3)
    } finally {
      await truncateAll()
    }
  },
)

test(
  'ChatBrowserRepository: lista, cuenta y carga el hilo de un chat',
  { skip: url ? undefined : 'DATABASE_URL not set' },
  async () => {
    const now = Date.now()
    try {
      await ensureTables()
      await truncateAll()

      await insert('chat', [
        {
          id: 'cb-chat-1',
          created_at: new Date(now),
          data: { type: 'PRIVATE', connections: [{ channelName: 'whatsapp', id: 'ext-1' }] },
        },
      ])
      await insert('chat_item', [
        { id: 'cb-i1', created_at: new Date(now), data: { type: 'humanMessage', humanMessage: { text: 'hola' } }, chatId: 'cb-chat-1' },
        { id: 'cb-i2', created_at: new Date(now + 1000), data: { type: 'functionCall', functionCall: { id: 'f', name: 'echo', arguments: '{}' } }, chatId: 'cb-chat-1' },
        { id: 'cb-i3', created_at: new Date(now + 2000), data: { type: 'botMessage', botMessage: { text: 'hola!' } }, chatId: 'cb-chat-1' },
      ])

      const repo = new ChatBrowserRepository(pool)
      const chats = await repo.listChats({ limit: 50, offset: 0 })
      assert.equal(chats.length, 1)
      assert.equal(chats[0].id, 'cb-chat-1')
      assert.equal(chats[0].msgCount, 3)
      assert.deepEqual(chats[0].channels, ['whatsapp'])

      assert.equal(await repo.countChats({}), 1)
      assert.equal(await repo.countChats({ channel: 'telegram' }), 0)

      const thread = await repo.chatThread('cb-chat-1')
      assert.equal(thread.length, 3)
      assert.equal(thread[0].type, 'humanMessage') // chronological ASC
      assert.equal(thread[2].type, 'botMessage')
      assert.equal((await repo.chatThread('nope')).length, 0)
    } finally {
      await truncateAll()
    }
  },
)
