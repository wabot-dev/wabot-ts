import * as path from 'node:path'

import { MigrationRunner } from './MigrationRunner'

export interface IMigrationCliOptions {
  /** Migrations directory. Default `<cwd>/migrations`. */
  dir?: string
  /** Postgres connection string. Default `process.env.DATABASE_URL`. */
  connectionString?: string
}

const USAGE = 'Usage: wabot-migrate <up | status | create <name>>'

// This is a user-facing CLI, so it prints to the console directly rather than
// through the framework Logger (which is silent unless DEBUG is set). The
// MigrationRunner library keeps using the Logger for embedded/server use.

/**
 * Entry point for the `wabot-migrate` CLI. Returns the process exit code.
 * `create` needs no database; `up`/`status` require a connection string.
 * Migrations are never applied automatically — this is the only path.
 */
export async function runMigrationCli(
  argv: string[],
  options: IMigrationCliOptions = {},
): Promise<number> {
  const [sub, ...rest] = argv
  const dir = options.dir ?? path.resolve(process.cwd(), 'migrations')

  if (sub === 'create') {
    const name = rest.join(' ').trim()
    if (!name) {
      console.error('Usage: wabot-migrate create <name>')
      return 1
    }
    const file = new MigrationRunner({ dir }).create(name)
    console.log(`Created ${file}`)
    return 0
  }

  // Validate the subcommand before requiring a connection, so an unknown
  // command reports the usage rather than a misleading DATABASE_URL error.
  if (sub !== undefined && sub !== 'up' && sub !== 'migrate' && sub !== 'status') {
    console.error(`Unknown command "${sub}". ${USAGE}`)
    return 1
  }

  const connectionString = options.connectionString ?? process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is required for "up" and "status"')
    return 1
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString })
  const runner = new MigrationRunner({ pool, dir })
  try {
    if (sub === 'status') {
      const rows = await runner.status()
      if (rows.length === 0) {
        console.log('No migrations found')
        return 0
      }
      for (const row of rows) {
        const state = row.drifted ? 'DRIFTED' : row.applied ? 'applied' : 'pending'
        console.log(`  ${state.padEnd(8)} ${row.id}`)
      }
      return rows.some((r) => r.drifted) ? 1 : 0
    }

    const { applied } = await runner.up()
    console.log(
      applied.length > 0
        ? `Applied ${applied.length} migration(s): ${applied.join(', ')}`
        : 'Already up to date',
    )
    return 0
  } catch (err) {
    console.error('Migration failed:', err instanceof Error ? err.message : err)
    return 1
  } finally {
    await pool.end()
  }
}
