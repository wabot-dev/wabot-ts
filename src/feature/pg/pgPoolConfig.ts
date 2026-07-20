import type { Pool, PoolConfig } from 'pg'

import { Env } from '@/core/env'
import { registerObservableGauge } from '@/core/observability'
import { IDbPoolOverrides } from '@/feature/repository'

/** Env var names for Postgres pool tuning. All optional — sane defaults below. */
export const PG_POOL_ENV = {
  max: 'WABOT_PG_POOL_MAX',
  min: 'WABOT_PG_POOL_MIN',
  idleTimeoutMs: 'WABOT_PG_IDLE_TIMEOUT_MS',
  connectionTimeoutMs: 'WABOT_PG_CONNECTION_TIMEOUT_MS',
  maxLifetimeSeconds: 'WABOT_PG_MAX_LIFETIME_SECONDS',
  statementTimeoutMs: 'WABOT_PG_STATEMENT_TIMEOUT_MS',
  appName: 'WABOT_PG_APP_NAME',
} as const

/**
 * Build the pg `Pool` config from `WABOT_PG_*` env vars, with production-safe
 * defaults:
 *
 * - `max` bounds the pool (pg default 10); raise it for throughput.
 * - `connectionTimeoutMillis` is finite (10s) — pg waits **forever** by default,
 *   which turns pool exhaustion into a silent hang. A finite value fails fast.
 * - `application_name` defaults to `wabot`, so the process is identifiable in
 *   `pg_stat_activity`.
 * - `maxLifetimeSeconds` and `statement_timeout` stay **off** (0) unless set —
 *   opt in to recycle long-lived connections (behind a load balancer) or to cap
 *   runaway queries server-side.
 */
export function buildPgPoolConfig(
  connectionString: string,
  env: Env,
  overrides: IDbPoolOverrides = {},
): PoolConfig {
  // Precedence: a per-database override (the provider's `pool()`) wins over the
  // process-wide `WABOT_PG_*` env var, which wins over the built-in default.
  const config: PoolConfig = {
    connectionString,
    max: overrides.max ?? env.requireNumber(PG_POOL_ENV.max, { default: 10 }),
    min: overrides.min ?? env.requireNumber(PG_POOL_ENV.min, { default: 0 }),
    idleTimeoutMillis:
      overrides.idleTimeoutMs ?? env.requireNumber(PG_POOL_ENV.idleTimeoutMs, { default: 10_000 }),
    connectionTimeoutMillis:
      overrides.connectionTimeoutMs ??
      env.requireNumber(PG_POOL_ENV.connectionTimeoutMs, { default: 10_000 }),
    application_name:
      overrides.applicationName ?? env.requireString(PG_POOL_ENV.appName, { default: 'wabot' }),
  }

  // 0 = disabled → omit so pg keeps its own (off) default instead of receiving a 0.
  const maxLifetimeSeconds =
    overrides.maxLifetimeSeconds ??
    env.requireNumber(PG_POOL_ENV.maxLifetimeSeconds, { default: 0 })
  if (maxLifetimeSeconds > 0) config.maxLifetimeSeconds = maxLifetimeSeconds

  const statementTimeoutMs =
    overrides.statementTimeoutMs ??
    env.requireNumber(PG_POOL_ENV.statementTimeoutMs, { default: 0 })
  if (statementTimeoutMs > 0) config.statement_timeout = statementTimeoutMs

  return config
}

const trackedPools: { database: string; pool: Pool }[] = []

/**
 * Track a pool for OpenTelemetry gauges (no-op when OTel isn't installed),
 * labeled by `database` so several pools report side by side. Sampled on each
 * collection, so they always reflect current state — a saturated pool shows up
 * as `wabot.pg.pool.waiting{database} > 0`.
 */
export function trackPgPool(database: string, pool: Pool): void {
  trackedPools.push({ database, pool })
  // Register-once (idempotent by name); each callback reads the shared, growing
  // set, emitting one series per tracked database.
  registerObservableGauge('wabot.pg.pool.total', () =>
    trackedPools.map((t) => ({ value: t.pool.totalCount, attributes: { database: t.database } })),
  )
  registerObservableGauge('wabot.pg.pool.idle', () =>
    trackedPools.map((t) => ({ value: t.pool.idleCount, attributes: { database: t.database } })),
  )
  registerObservableGauge('wabot.pg.pool.waiting', () =>
    trackedPools.map((t) => ({ value: t.pool.waitingCount, attributes: { database: t.database } })),
  )
}
