import { AsyncLocalStorage } from 'async_hooks'
import { Pool, PoolClient } from 'pg'

// Map each Pool instance to its active client in the current async context
export type ClientMap = Map<Pool, PoolClient>

export const pgStorage = new AsyncLocalStorage<ClientMap>()

/**
 * Get or initialize the client map for the current async context
 */
export function getClientMap(): ClientMap {
  let map = pgStorage.getStore()
  if (!map) {
    map = new Map()
    pgStorage.enterWith(map)
  }
  return map
}
