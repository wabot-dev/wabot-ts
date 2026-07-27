import test from 'node:test'
import assert from 'node:assert/strict'

import { container } from '@/core/injection'
import { isNumber, isString } from '@/core/validation'
import { memExtension } from './@memExtension'
import { projection } from './@projection'
import { MemoryProjectionExtension } from './MemoryProjectionExtension'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { Projection } from './Projection'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'
import type { IProjectionRuntime } from './IProjectionRuntime'
import type { IRepositoryAdapter } from './IRepositoryAdapter'

class CustomerRevenueRow {
  @isString() customerId!: string
  @isNumber() total!: number
}

@projection()
class CustomerRevenue extends Projection {
  async topSpenders(limit: number): Promise<CustomerRevenueRow[]> {
    return this.query(
      CustomerRevenueRow,
      `SELECT c.id AS "customerId", sum(o.total) AS total
         FROM orders o JOIN customers c ON c.id = o.customer_id
        GROUP BY c.id ORDER BY total DESC LIMIT $1`,
      [limit],
    )
  }
}

@memExtension(CustomerRevenue)
class CustomerRevenueMemory extends MemoryProjectionExtension {
  async topSpenders(limit: number): Promise<CustomerRevenueRow[]> {
    return [
      Object.assign(new CustomerRevenueRow(), { customerId: 'from-memory', total: 10 }),
    ].slice(0, limit)
  }
}

/** A projection nobody wrote an in-memory answer for. */
@projection()
class Unserved extends Projection {
  async anything(): Promise<unknown[]> {
    return this.query(CustomerRevenueRow, 'SELECT 1')
  }
}

/** Stands in for a backend that speaks SQL, capturing what the projection sent. */
function sqlAdapter(rows: unknown[]) {
  const sent: { sql: string; params: unknown[] }[] = []
  const runtime: IProjectionRuntime = {
    async query(_row, sql, params = []) {
      sent.push({ sql, params })
      return rows as any
    },
  }
  const adapter = {
    id: Symbol('fake-sql'),
    build: () => {
      throw new Error('not used')
    },
    buildProjection: () => runtime,
  } as unknown as IRepositoryAdapter
  return { adapter, sent }
}

function useAdapter(adapter: IRepositoryAdapter) {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(adapter)
}

test('on a backend with statements, the class body runs its own SQL', async () => {
  const expected = [Object.assign(new CustomerRevenueRow(), { customerId: 'c1', total: 42 })]
  const { adapter, sent } = sqlAdapter(expected)
  useAdapter(adapter)

  const result = await new CustomerRevenue().topSpenders(5)

  assert.deepEqual(result, expected)
  assert.equal(sent.length, 1)
  assert.match(sent[0].sql, /JOIN customers/)
  assert.deepEqual(sent[0].params, [5])
})

test('on a backend without statements, the memory implementation answers', async () => {
  useAdapter(new MemoryRepositoryAdapter({ persist: false }))

  const result = await new CustomerRevenue().topSpenders(5)

  assert.equal(result[0].customerId, 'from-memory')
})

test('a projection with no in-memory implementation says so, naming itself', () => {
  useAdapter(new MemoryRepositoryAdapter({ persist: false }))

  // A wiring error, raised as the call is made: the startup check is what
  // should normally catch this, long before anyone calls the method.
  assert.throws(
    () => new Unserved().anything(),
    /Unserved: the active backend cannot run the projection's statements/,
  )
})

test('the startup check refuses a backend that cannot serve every projection', () => {
  const store = container.resolve(RepositoryMetadataStore)
  const memoryId = new MemoryRepositoryAdapter({ persist: false }).id

  assert.throws(
    () => store.validateExtensionsRegistered(memoryId, false),
    /Projection wiring error[\s\S]*Unserved/,
  )
  // A backend that runs statements needs no per-projection implementation.
  assert.doesNotThrow(() => store.validateExtensionsRegistered(memoryId, true))
})
