// A repository over a table it did not create: `bigserial` id, snake_case
// columns. The `@query` DSL can only derive camelCase names from a method
// name, so these cover that the derived name reaches the right column — on the
// memory backend, on Postgres, and in the indexes derived from the same names.

import test from 'node:test'
import assert from 'node:assert/strict'
import type { Pool } from 'pg'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { PgRepositoryAdapter } from '@/feature/pg'
import { PgColumnsRepository } from '@/feature/pg/PgColumnsRepository'
import { repository } from './@repository'
import { query } from './@query'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

interface ICallData extends IEntityData {
  funding_opportunity_id?: string
  start_date?: string
  status?: string
}

class Call extends Entity<ICallData> {}

const FIELDS = ['funding_opportunity_id', 'start_date', 'status'] as const

@repository({
  table: 'funding_call',
  constructor: Call,
  fields: [...FIELDS],
})
class CallRepository extends PgColumnsRepository<Call> {
  @query() declare findByFundingOpportunityId: (id: string) => Promise<Call[]>
  @query() declare findOneByFundingOpportunityIdAndStatus: (
    id: string,
    status: string,
  ) => Promise<Call | null>
  @query() declare countByStatus: (status: string) => Promise<number>
  @query() declare findByStatusOrderByStartDateDesc: (status: string) => Promise<Call[]>
}

interface IRecorded {
  sql: string
  params: any[]
}

function stubPool(rows: any[] = []): { pool: Pool; queries: IRecorded[] } {
  const queries: IRecorded[] = []
  const client = {
    query: async (sql: string, params: any[]) => {
      queries.push({ sql, params })
      return { rows, rowCount: rows.length }
    },
    release: () => {},
  }
  return { pool: { connect: async () => client } as unknown as Pool, queries }
}

function useAdapter(adapter: MemoryRepositoryAdapter | PgRepositoryAdapter): CallRepository {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(adapter)
  return new CallRepository()
}

test.describe('the @query DSL on snake_case columns', () => {
  test('memory: the derived name finds the field the repository declared', async () => {
    const repo = useAdapter(new MemoryRepositoryAdapter({ persist: false }))

    const call = new Call({ funding_opportunity_id: 'op-1', status: 'open' })
    await repo.create(call)
    await repo.create(new Call({ funding_opportunity_id: 'op-2', status: 'open' }))

    const found = await repo.findByFundingOpportunityId('op-1')
    assert.equal(found.length, 1)
    assert.equal(found[0].id, call.id)

    const one = await repo.findOneByFundingOpportunityIdAndStatus('op-2', 'open')
    assert.equal(one?.['data'].funding_opportunity_id, 'op-2')
    assert.equal(await repo.countByStatus('open'), 2)
  })

  test('memory: a value that matches nothing still returns nothing', async () => {
    const repo = useAdapter(new MemoryRepositoryAdapter({ persist: false }))
    await repo.create(new Call({ funding_opportunity_id: 'op-1', status: 'open' }))

    assert.deepEqual(await repo.findByFundingOpportunityId('op-9'), [])
  })

  test('postgres: the WHERE clause names the real column', async () => {
    const { pool, queries } = stubPool()
    const repo = useAdapter(new PgRepositoryAdapter(pool))

    await repo.findByFundingOpportunityId('op-1')

    assert.match(queries[0].sql, /WHERE "funding_opportunity_id" = \$1/)
    assert.doesNotMatch(queries[0].sql, /fundingOpportunityId/)
    assert.deepEqual(queries[0].params, ['op-1'])
  })

  test('postgres: ORDER BY names it too', async () => {
    const { pool, queries } = stubPool()
    const repo = useAdapter(new PgRepositoryAdapter(pool))

    await repo.findByStatusOrderByStartDateDesc('open')

    assert.match(queries[0].sql, /ORDER BY "start_date" DESC/)
  })

  test('the indexes derived from those methods are declared on the real columns', () => {
    const config = container.resolve(RepositoryMetadataStore).getRepositoryConfig(CallRepository)
    const indexed = (config?.indexes ?? []).flatMap((decl) => decl.fields).sort()

    assert.deepEqual(indexed, ['funding_opportunity_id', 'start_date', 'status'])
  })
})
