import { Pool, PoolClient } from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import { clearOnDetach } from '@/core/async-scope'

interface ISharedClient {
  client: PoolClient
  /** Calls running on the client; it goes back to the pool when the last one ends. */
  users: number
}

// Async-local storage for clients per pool. A call that acquires a client runs
// `fn` in a context of its own (`run`, never `enterWith`): entering the caller's
// context would hand the client to whatever the caller runs next, including
// calls running alongside this one, which would then share its connection, its
// advisory locks and its transactions.
const pgStorage = new AsyncLocalStorage<Map<Pool, ISharedClient>>()

// Work started through `runDetached` (a job) acquires clients of its own, even
// when the call that started it is still holding one.
clearOnDetach((fn) => pgStorage.run(new Map(), fn))

function activeClient(pool: Pool): ISharedClient | null {
  const shared = pgStorage.getStore()?.get(pool)
  return shared && shared.users > 0 ? shared : null
}

async function useClient<T>(
  shared: ISharedClient,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  shared.users++
  try {
    return await fn(shared.client)
  } finally {
    if (--shared.users === 0) shared.client.release()
  }
}

/**
 * Runs a function with a shared Postgres client for the given pool.
 * Reuses the client if already present in the async context.
 */
export async function withPgClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const current = activeClient(pool)
  if (current) {
    // Already a shared client in async context, reuse it. Counted, so a call
    // that outlives the one that acquired the client (work started without
    // awaiting it) keeps it out of the pool until it ends too.
    return useClient(current, fn)
  }

  // No client yet, acquire a new one
  const shared: ISharedClient = { client: await pool.connect(), users: 0 }
  const clients = new Map(pgStorage.getStore())
  clients.set(pool, shared)

  return pgStorage.run(clients, () => useClient(shared, fn))
}

/**
 * Get the current shared client for a pool.
 * Falls back to the pool itself if no shared client exists.
 */
export function getPgClient(pool: Pool): PoolClient | Pool {
  return activeClient(pool)?.client ?? pool
}
