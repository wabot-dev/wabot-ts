import { dbPool } from './@dbPool'
import { IDbPoolProvider } from './IDbPoolProvider'

/**
 * The built-in default database — used by every repository that doesn't set
 * `pool`. Reads `DATABASE_URL` (empty → in-memory fallback), matching the
 * pre-multi-database behavior. It also owns the framework's non-repository
 * services (chat memory, jobs, locker, idempotency, rate limiting).
 */
@dbPool()
export class DefaultDbPool implements IDbPoolProvider {
  connection(): string {
    return process.env.DATABASE_URL ?? ''
  }
}
