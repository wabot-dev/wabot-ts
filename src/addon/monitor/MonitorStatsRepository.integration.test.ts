import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

import { MonitorStatsRepository } from './MonitorStatsRepository'

const url = process.env.DATABASE_URL

type Row = { id: string; created_at: Date; data: object }

/**
 * Verifies the repository's aggregate SQL against a real PostgreSQL.
 *
 * DESTRUCTIVE: truncates wabot.{chat,chat_item,job,cron_job}. Run only against a
 * throwaway DB — e.g. the Neon `wabot-monitor-test` project. Skipped when
 * DATABASE_URL is unset, so `npm run test:units` is unaffected.
 */
test(
  'MonitorStatsRepository: los agregados matchean los datos sembrados',
  { skip: url ? undefined : 'DATABASE_URL not set' },
  async () => {
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
    const now = Date.now()
    const H = 3_600_000
    const D = 86_400_000

    const conversations: Row[] = []
    const messages: Row[] = []
    const jobs: Row[] = []
    const cron: Row[] = []

    // 20 conversations: whatsapp×8, telegram×5, slack×4, hubspot×2, facebook×1
    // 14 PRIVATE + 6 GROUP. created_at: 1-5 within 24h, 6-10 within 7d, rest old.
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
        conversations.push({
          id: `mt-chat-${n}`,
          created_at: new Date(n <= 5 ? now - n * H : n <= 10 ? now - (2 + (n - 5)) * D : now - 30 * D),
          data: {
            type: n <= 14 ? 'PRIVATE' : 'GROUP',
            connections: [{ channelName: channel, id: `ext-${n}` }],
          },
        })
      }
    }

    // 70 messages: humanMessage×30, botMessage×30, functionCall×10. 15 within 24h.
    const msgTypes: [string, number][] = [
      ['humanMessage', 30],
      ['botMessage', 30],
      ['functionCall', 10],
    ]
    let m = 0
    for (const [type, count] of msgTypes) {
      for (let k = 0; k < count; k++) {
        m++
        messages.push({
          id: `mt-msg-${m}`,
          created_at: new Date(m <= 15 ? now - m * (H / 2) : now - 20 * D),
          data: { type },
        })
      }
    }

    // 15 jobs: 2 running, 5 pending (3 fresh + 2 awaiting retry), 5 succeeded,
    // 3 failed (2 with error), 2 retrying-with-error → countErrors=4, failed=3.
    for (let i = 1; i <= 2; i++)
      jobs.push({ id: `mt-run-${i}`, created_at: new Date(now - H), data: { commandName: 'ingest', scheduledAt: now - H, startedAt: now - H / 2 } })
    for (let i = 1; i <= 3; i++)
      jobs.push({ id: `mt-pend-${i}`, created_at: new Date(now - H), data: { commandName: 'ingest', scheduledAt: now + H } })
    for (let i = 1; i <= 5; i++)
      jobs.push({ id: `mt-ok-${i}`, created_at: new Date(now - 2 * D), data: { commandName: 'ingest', scheduledAt: now - 2 * D, startedAt: now - 2 * D, successAt: now - 2 * D + 60_000 } })
    const failedCmds = ['sync-leads', 'sync-leads', 'purge-old']
    for (let i = 0; i < 3; i++)
      jobs.push({
        id: `mt-fail-${i + 1}`,
        created_at: new Date(now - 3 * D),
        data: {
          commandName: failedCmds[i],
          scheduledAt: now - 3 * D,
          startedAt: now - 3 * D,
          failedAt: now - 3 * D + 60_000,
          ...(i < 2 ? { error: { time: now - i * H, message: `failed ${failedCmds[i]}` } } : {}),
        },
      })
    const retryCmds = ['send-message', 'fetch-crm']
    for (let i = 0; i < 2; i++)
      jobs.push({
        id: `mt-retry-${i + 1}`,
        created_at: new Date(now - H),
        data: { commandName: retryCmds[i], scheduledAt: now + H, retryAt: now + H, error: { time: now - i * H, message: `retry ${retryCmds[i]}` } },
      })

    cron.push({ id: 'mt-cron-1', created_at: new Date(now - 10 * D), data: { name: 'nightly-sync', commandName: 'sync', cron: '0 2 * * *', enabled: true, lastRunAt: now - D, nextRunAt: now + H } })
    cron.push({ id: 'mt-cron-2', created_at: new Date(now - 10 * D), data: { name: 'hourly-report', commandName: 'report', cron: '0 * * * *', enabled: false, lastRunAt: now - 2 * H, nextRunAt: now - H } })

    const insert = async (table: string, rows: Row[]) => {
      for (const r of rows)
        await pool.query(`INSERT INTO wabot.${table} (id, created_at, data) VALUES ($1, $2, $3)`, [r.id, r.created_at, JSON.stringify(r.data)])
    }
    const byName = (xs: { name: string; count: number }[]) => Object.fromEntries(xs.map((x) => [x.name, x.count]))

    try {
      await pool.query('CREATE SCHEMA IF NOT EXISTS wabot')
      for (const t of ['chat', 'chat_item', 'job', 'cron_job'])
        await pool.query(`CREATE TABLE IF NOT EXISTS wabot.${t} (id TEXT PRIMARY KEY, created_at TIMESTAMP, data JSONB)`)
      for (const t of ['chat_item', 'chat', 'job', 'cron_job']) await pool.query(`TRUNCATE wabot.${t}`)

      await insert('chat', conversations)
      await insert('chat_item', messages)
      await insert('job', jobs)
      await insert('cron_job', cron)

      const repo = new MonitorStatsRepository(pool)

      assert.equal(await repo.countConversations(), 20)
      assert.equal(byName(await repo.conversationsByChannel()).whatsapp, 8)
      assert.equal(byName(await repo.conversationsByChannel()).facebook, 1)
      assert.equal(byName(await repo.conversationsByType()).PRIVATE, 14)
      assert.equal(byName(await repo.conversationsByType()).GROUP, 6)
      assert.equal(await repo.countNewConversationsSince(new Date(now - 24 * H)), 5)
      assert.equal(await repo.countNewConversationsSince(new Date(now - 7 * D)), 10)

      const msgByType = await repo.messagesByType()
      assert.equal(msgByType.reduce((a, r) => a + r.count, 0), 70)
      assert.equal(byName(msgByType).humanMessage, 30)
      assert.equal(byName(msgByType).botMessage, 30)
      assert.equal(byName(msgByType).functionCall, 10)
      assert.equal(await repo.countMessagesSince(new Date(now - 24 * H)), 15)

      assert.equal(await repo.countErrors(), 4)
      assert.equal(await repo.countErrorsSince(now - 24 * H), 4)
      assert.equal(byName(await repo.errorsByCommand())['sync-leads'], 2)
      assert.equal((await repo.recentErrors()).length, 4)

      const jobCounts = await repo.jobCounts()
      assert.deepEqual(jobCounts, { running: 2, pending: 5, succeeded: 5, failed: 0 + 3 })

      const cronRows = await repo.cronRows()
      assert.equal(cronRows.length, 2)
      assert.equal(cronRows[0].name, 'hourly-report')
    } finally {
      for (const t of ['chat_item', 'chat', 'job', 'cron_job']) await pool.query(`TRUNCATE wabot.${t}`)
      await pool.end()
    }
  },
)
