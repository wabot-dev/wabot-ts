/**
 * Per-database pool overrides, merged over the process-wide `WABOT_PG_*`
 * defaults. Kept backend-agnostic (no `pg` types) so the abstraction stays in
 * the repository layer; the Postgres backend maps these onto its `PoolConfig`.
 */
export interface IDbPoolOverrides {
  max?: number
  min?: number
  idleTimeoutMs?: number
  connectionTimeoutMs?: number
  maxLifetimeSeconds?: number
  statementTimeoutMs?: number
  applicationName?: string
}

/**
 * Supplies the connection for one logical database. A repository points at a
 * provider **class** via `@repository({ pool: MyPool })`; the runner resolves the
 * provider through DI, builds one tuned pool per provider, and routes that repo's
 * queries to it.
 *
 * `connection()` may be async, so the string can come from a secret manager
 * (Vault/KMS) at boot. Return an empty/non-Postgres value to fall back to an
 * in-memory store for that database (tests, no DB).
 */
export interface IDbPoolProvider {
  connection(): string | Promise<string>
  /** Optional per-database pool tuning, layered over the `WABOT_PG_*` defaults. */
  pool?(): IDbPoolOverrides
}
