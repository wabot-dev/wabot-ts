import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { AuditLog, IAuditActor, IAuditEntry, IAuditQuery } from '@/core/audit'
import { Logger } from '@/core/logger'
import { PgLocker } from './PgLocker'
import { withPgClient } from './withPgClient'

const SCHEMA = 'wabot'
const STREAM_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * Postgres audit log. Each stream is its own append-only table
 * `wabot.audit_<stream>`, so volume shards by domain and each table can be
 * indexed, partitioned, retained, or moved independently. Tables are created on
 * first use (idempotent, advisory-locked). A stream can be routed to its own
 * pool via `setStreamPool` — otherwise it uses the default pool.
 */
@singleton()
export class PgAuditLog extends AuditLog {
  private ensured = new Set<string>()
  private streamPools = new Map<string, Pool>()
  private logger = new Logger('wabot:pg-audit-log')

  constructor(private readonly defaultPool: Pool) {
    super()
  }

  /** Route a stream's table to a specific pool (e.g. a repository's audit database). */
  setStreamPool(stream: string, pool: Pool): void {
    this.streamPools.set(this.validate(stream), pool)
  }

  private validate(stream: string): string {
    if (!STREAM_PATTERN.test(stream)) {
      throw new Error(
        `Invalid audit stream "${stream}": use lowercase letters, digits and underscores.`,
      )
    }
    return stream
  }

  private poolFor(stream: string): Pool {
    return this.streamPools.get(stream) ?? this.defaultPool
  }

  private table(stream: string): string {
    return `"${SCHEMA}"."audit_${stream}"`
  }

  protected async append(entry: IAuditEntry): Promise<void> {
    const stream = this.validate(entry.stream)
    const pool = this.poolFor(stream)
    await this.ensureTable(pool, stream)
    const table = this.table(stream)
    await withPgClient(pool, (client) =>
      client.query(
        `INSERT INTO ${table}
           (id, created_at, action, target_id, actor_type, actor_id, request_id, source, actor, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          entry.id,
          new Date(entry.createdAt),
          entry.action,
          entry.target ?? null,
          entry.actor.type,
          entry.actor.id ?? null,
          entry.requestId ?? null,
          entry.source ?? null,
          JSON.stringify(entry.actor),
          entry.data ? JSON.stringify(entry.data) : null,
        ],
      ),
    )
  }

  async query(query: IAuditQuery): Promise<IAuditEntry[]> {
    const stream = this.validate(query.stream)
    const pool = this.poolFor(stream)
    await this.ensureTable(pool, stream)
    const table = this.table(stream)

    const conditions: string[] = []
    const params: unknown[] = []
    const add = (sql: string, value: unknown) => {
      params.push(value)
      conditions.push(sql.replace('?', `$${params.length}`))
    }
    if (query.target !== undefined) add('target_id = ?', query.target)
    if (query.action !== undefined) add('action = ?', query.action)
    if (query.actorId !== undefined) add('actor_id = ?', query.actorId)
    if (query.from !== undefined) add('created_at >= ?', new Date(query.from))
    if (query.to !== undefined) add('created_at <= ?', new Date(query.to))

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    const limit = query.limit !== undefined ? ` LIMIT ${Math.max(0, Math.floor(query.limit))}` : ''
    const sql = `SELECT * FROM ${table}${where} ORDER BY created_at DESC, id DESC${limit}`

    return withPgClient(pool, async (client) => {
      const { rows } = await client.query(sql, params)
      return rows.map((row) => this.deserialize(stream, row))
    })
  }

  private deserialize(stream: string, row: any): IAuditEntry {
    const actor: IAuditActor = row.actor ?? { type: row.actor_type, id: row.actor_id ?? undefined }
    return {
      id: row.id,
      createdAt: row.created_at instanceof Date ? row.created_at.getTime() : row.created_at,
      stream,
      action: row.action,
      target: row.target_id ?? undefined,
      actor,
      requestId: row.request_id ?? undefined,
      source: row.source ?? undefined,
      data: row.data ?? undefined,
    }
  }

  private async ensureTable(pool: Pool, stream: string): Promise<void> {
    if (this.ensured.has(stream)) return
    const table = this.table(stream)
    await new PgLocker(pool).withKey(`wabot-audit-ensure-${stream}`).run(async () => {
      if (this.ensured.has(stream)) return
      await withPgClient(pool, async (client) => {
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`)
        await client.query(
          `CREATE TABLE IF NOT EXISTS ${table} (
             id TEXT PRIMARY KEY,
             created_at TIMESTAMPTZ NOT NULL,
             action TEXT NOT NULL,
             target_id TEXT,
             actor_type TEXT,
             actor_id TEXT,
             request_id TEXT,
             source TEXT,
             actor JSONB,
             data JSONB
           )`,
        )
        await client.query(
          `CREATE INDEX IF NOT EXISTS "audit_${stream}_target_idx"
             ON ${table} (target_id, created_at DESC)`,
        )
        await client.query(
          `CREATE INDEX IF NOT EXISTS "audit_${stream}_created_idx"
             ON ${table} (created_at DESC)`,
        )
      })
      this.ensured.add(stream)
      this.logger.debug(`ensured audit table ${table}`)
    })
  }
}
