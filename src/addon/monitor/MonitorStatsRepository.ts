import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import type { ICronRow, IErrorRow, IJobStats, INameCount } from './IMonitorStats'

/**
 * Read-only aggregate queries over the framework's own tables (schema `wabot`).
 *
 * Does NOT mutate, does NOT create tables, and does NOT extend PgCrudRepository
 * — its query() maps rows into entities and assumes a `data` column, which is
 * useless for COUNT/GROUP BY. We run plain SQL through Pool.query instead.
 *
 * Each public method swallows query errors and returns a safe default (0 / []),
 * so a missing table on a fresh DB or a single bad row can never take down the
 * whole dashboard. The framework repos create these tables lazily on first use,
 * so in any running bot they already exist.
 *
 * PG-only: Pool is registered by ProjectRunner only when DATABASE_URL is set.
 */
@singleton()
export class MonitorStatsRepository {
  constructor(private pool: Pool) {}

  // ---- conversations (wabot.chat) ----

  async countConversations(): Promise<number> {
    return this.count('SELECT COUNT(*)::int AS count FROM wabot.chat')
  }

  async conversationsByType(): Promise<INameCount[]> {
    return this.nameCounts(
      'SELECT data->>\'type\' AS name, COUNT(*)::int AS count FROM wabot.chat GROUP BY 1',
    )
  }

  async conversationsByChannel(): Promise<INameCount[]> {
    return this.nameCounts(
      `SELECT conn->>'channelName' AS name, COUNT(*)::int AS count
         FROM wabot.chat, jsonb_array_elements(data->'connections') AS conn
        GROUP BY 1 ORDER BY count DESC`,
    )
  }

  async countNewConversationsSince(since: Date): Promise<number> {
    return this.count('SELECT COUNT(*)::int AS count FROM wabot.chat WHERE created_at >= $1', [since])
  }

  // ---- messages (wabot.chat_item) ----

  async messagesByType(): Promise<INameCount[]> {
    return this.nameCounts(
      'SELECT data->>\'type\' AS name, COUNT(*)::int AS count FROM wabot.chat_item GROUP BY 1',
    )
  }

  async countMessagesSince(since: Date): Promise<number> {
    return this.count('SELECT COUNT(*)::int AS count FROM wabot.chat_item WHERE created_at >= $1', [
      since,
    ])
  }

  // ---- errors (wabot.job rows carrying data.error) ----

  async countErrors(): Promise<number> {
    return this.count("SELECT COUNT(*)::int AS count FROM wabot.job WHERE data->'error' IS NOT NULL")
  }

  /** sinceMs is an epoch-ms cutoff (error.time is stored as epoch ms in JSONB). */
  async countErrorsSince(sinceMs: number): Promise<number> {
    return this.count(
      `SELECT COUNT(*)::int AS count FROM wabot.job
        WHERE data->'error' IS NOT NULL AND (data->'error'->>'time')::bigint >= $1`,
      [sinceMs],
    )
  }

  async recentErrors(): Promise<IErrorRow[]> {
    try {
      const { rows } = await this.pool.query(
        `SELECT id,
                data->>'commandName' AS "commandName",
                data->'error'->>'message' AS message,
                (data->'error'->>'time')::bigint AS time,
                data->'error'->>'stack' AS stack
           FROM wabot.job
          WHERE data->'error' IS NOT NULL
          ORDER BY time DESC LIMIT 10`,
      )
      // node-pg returns bigint as string — coerce back to number.
      return rows.map((r: any) => ({
        id: r.id,
        commandName: r.commandName,
        message: r.message,
        time: r.time == null ? null : Number(r.time),
        stack: r.stack ?? null,
      }))
    } catch {
      return []
    }
  }

  async errorsByCommand(): Promise<INameCount[]> {
    return this.nameCounts(
      `SELECT data->>'commandName' AS name, COUNT(*)::int AS count
         FROM wabot.job
        WHERE data->'error' IS NOT NULL
        GROUP BY 1 ORDER BY count DESC`,
    )
  }

  // ---- jobs (wabot.job) ----

  async jobCounts(): Promise<IJobStats> {
    try {
      const { rows } = await this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE (data->>'startedAt') IS NOT NULL
                              AND data->>'successAt' IS NULL
                              AND data->>'failedAt' IS NULL) AS running,
           COUNT(*) FILTER (WHERE (data->>'failedAt') IS NULL
                              AND (data->>'successAt') IS NULL
                              AND (data->>'startedAt') IS NULL) AS pending,
           COUNT(*) FILTER (WHERE (data->>'successAt') IS NOT NULL) AS succeeded,
           COUNT(*) FILTER (WHERE (data->>'failedAt') IS NOT NULL) AS failed
         FROM wabot.job`,
      )
      const r = rows[0] as any
      return {
        running: Number(r?.running ?? 0),
        pending: Number(r?.pending ?? 0),
        succeeded: Number(r?.succeeded ?? 0),
        failed: Number(r?.failed ?? 0),
      }
    } catch {
      return { running: 0, pending: 0, succeeded: 0, failed: 0 }
    }
  }

  // ---- cron (wabot.cron_job) ----

  async cronRows(): Promise<ICronRow[]> {
    try {
      const { rows } = await this.pool.query(
        `SELECT data->>'name' AS name,
                data->>'commandName' AS "commandName",
                data->>'cron' AS cron,
                (data->>'enabled')::boolean AS enabled,
                (data->>'lastRunAt')::bigint AS "lastRunAt",
                (data->>'nextRunAt')::bigint AS "nextRunAt"
           FROM wabot.cron_job ORDER BY name`,
      )
      // bigint columns come back as strings — coerce.
      return rows.map((r: any) => ({
        name: r.name,
        commandName: r.commandName,
        cron: r.cron,
        enabled: r.enabled !== false,
        lastRunAt: r.lastRunAt == null ? null : Number(r.lastRunAt),
        nextRunAt: r.nextRunAt == null ? null : Number(r.nextRunAt),
      }))
    } catch {
      return []
    }
  }

  // ---- helpers ----

  private async count(sql: string, params?: unknown[]): Promise<number> {
    try {
      const { rows } = await this.pool.query<{ count: number | string }>(sql, params)
      return Number(rows[0]?.count ?? 0)
    } catch {
      return 0
    }
  }

  private async nameCounts(sql: string, params?: unknown[]): Promise<INameCount[]> {
    try {
      const { rows } = await this.pool.query<INameCount>(sql, params)
      return rows.map((r) => ({ name: r.name, count: Number(r.count) }))
    } catch {
      return []
    }
  }
}
