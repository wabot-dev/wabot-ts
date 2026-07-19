import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Pool } from 'pg'

import { Logger } from '@/core/logger'
import { PgLocker } from '../PgLocker'
import { withPgClient } from '../withPgClient'
import { withPgTransaction } from '../withPgTransaction'
import {
  computeChecksum,
  nextMigrationFilename,
  parseMigrationName,
  planMigrations,
} from './migrationSupport'

export interface IMigrationRunnerConfig {
  /** Required for `up`/`status`; not needed for `create`. */
  pool?: Pool
  /** Directory holding the `.sql` migration files. */
  dir: string
  /** Schema for the `_wabot_migrations` tracking table. Default `public`. */
  schema?: string
}

export interface IMigrationFile {
  id: string
  order: number
  path: string
  sql: string
  checksum: string
}

export interface IMigrationStatus {
  id: string
  applied: boolean
  drifted: boolean
  appliedAt: Date | null
}

const TEMPLATE = (name: string) =>
  `-- ${name}\n-- Plain SQL. Applied once, inside a transaction. Migrations are immutable\n-- after they run — add a new migration to change the schema.\n\n`

/**
 * Applies plain-SQL migrations from a directory, tracked in a `_wabot_migrations`
 * table. Forward-only. `up()` runs pending migrations each in its own
 * transaction, serialized across instances by a Postgres advisory lock, and
 * refuses to run if an already-applied migration's file was edited (checksum
 * drift). Never invoked automatically at boot — driven by the `wabot-migrate` CLI.
 */
export class MigrationRunner {
  private logger = new Logger('wabot:migrations')

  constructor(private readonly config: IMigrationRunnerConfig) {}

  private get schema(): string {
    return this.config.schema ?? 'public'
  }

  private get trackingTable(): string {
    return `"${this.schema}"."_wabot_migrations"`
  }

  private requirePool(): Pool {
    if (!this.config.pool) {
      throw new Error('MigrationRunner requires a pool for database operations')
    }
    return this.config.pool
  }

  /** Read + checksum the on-disk migrations, ordered by numeric prefix. */
  discover(): IMigrationFile[] {
    const dir = this.config.dir
    if (!fs.existsSync(dir)) return []

    const files: IMigrationFile[] = []
    for (const filename of fs.readdirSync(dir)) {
      const parsed = parseMigrationName(filename)
      if (!parsed) continue
      const full = path.join(dir, filename)
      const sql = fs.readFileSync(full, 'utf-8')
      files.push({ ...parsed, path: full, sql, checksum: computeChecksum(sql) })
    }
    files.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    return files
  }

  /** Scaffold a new migration file and return its path. */
  create(name: string): string {
    const dir = this.config.dir
    const existing = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .map(parseMigrationName)
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => p.id)
      : []
    const filename = nextMigrationFilename(existing, name)
    fs.mkdirSync(dir, { recursive: true })
    const full = path.join(dir, filename)
    fs.writeFileSync(full, TEMPLATE(filename), 'utf-8')
    return full
  }

  async status(): Promise<IMigrationStatus[]> {
    await this.ensureTable()
    const files = this.discover()
    const applied = await this.readApplied()
    const appliedById = new Map(applied.map((a) => [a.name, a]))
    return files.map((file) => {
      const row = appliedById.get(file.id)
      return {
        id: file.id,
        applied: row !== undefined,
        drifted: row !== undefined && row.checksum !== file.checksum,
        appliedAt: row?.applied_at ?? null,
      }
    })
  }

  async up(): Promise<{ applied: string[] }> {
    await this.ensureTable()

    const appliedIds: string[] = []
    const locker = new PgLocker(this.requirePool())
    await locker.withKey('wabot-migrations').run(async () => {
      const files = this.discover()
      const applied = await this.readApplied()
      const plan = planMigrations(
        files.map((f) => ({ id: f.id, checksum: f.checksum })),
        applied,
      )

      if (plan.drifted.length > 0) {
        throw new Error(
          `Migration drift detected: ${plan.drifted.join(', ')} changed after being applied. ` +
            `Migrations are immutable — add a new migration instead of editing an applied one.`,
        )
      }
      for (const name of plan.missing) {
        this.logger.warn(`Applied migration "${name}" no longer has a file in ${this.config.dir}`)
      }

      for (const id of plan.pending) {
        const file = files.find((f) => f.id === id)!
        this.logger.info(`Applying migration ${id}`)
        await withPgTransaction(this.requirePool(), async (client) => {
          await client.query(file.sql)
          await client.query(`INSERT INTO ${this.trackingTable} (name, checksum) VALUES ($1, $2)`, [
            file.id,
            file.checksum,
          ])
        })
        appliedIds.push(id)
      }
    })

    return { applied: appliedIds }
  }

  private async ensureTable(): Promise<void> {
    await withPgClient(this.requirePool(), async (client) => {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`)
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${this.trackingTable} (
          name TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
      )
    })
  }

  private async readApplied(): Promise<{ name: string; checksum: string; applied_at: Date }[]> {
    return withPgClient(this.requirePool(), async (client) => {
      const { rows } = await client.query(
        `SELECT name, checksum, applied_at FROM ${this.trackingTable} ORDER BY applied_at`,
      )
      return rows
    })
  }
}
