import { Pool, PoolClient } from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'

// Async-local storage for clients per pool
const pgStorage = new AsyncLocalStorage<Map<Pool, PoolClient>>()

function getClientMap(): Map<Pool, PoolClient> {
  let map = pgStorage.getStore()
  if (!map) {
    map = new Map()
    pgStorage.enterWith(map)
  }
  return map
}

/**
 * Runs a function with a shared Postgres client for the given pool.
 * Reuses the client if already present in the async context.
 */
export async function withPgClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const clients = getClientMap()

  if (clients.has(pool)) {
    // Already a shared client in async context, reuse it
    return fn(clients.get(pool)!)
  }

  // No client yet, acquire a new one
  const client = await pool.connect()

  try {
    clients.set(pool, client)
    return await fn(client)
  } finally {
    clients.delete(pool)
    client.release()
  }
}

/**
 * Get the current shared client for a pool.
 * Falls back to the pool itself if no shared client exists.
 */
export function getPgClient(pool: Pool): PoolClient | Pool {
  const clients = pgStorage.getStore()
  if (clients?.has(pool)) return clients.get(pool)!
  return pool
}
