/**
 * Identifies the Postgres backend in a storage declaration. Lives on its own so
 * the repository bases that reference it never reach for the driver.
 */
export const PG_ENGINE = Symbol('pg')

/** Storage strategies the Postgres backend serves. */
export type PgStorageStrategy = 'jsonb' | 'columns'

export const PG_JSONB = { engine: PG_ENGINE, strategy: 'jsonb' } as const
export const PG_COLUMNS = { engine: PG_ENGINE, strategy: 'columns' } as const
