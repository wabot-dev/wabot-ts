import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { pgJsonRepository } from './@pgJsonRepository'
import { query, RepositoryAdapterRegistry, RepositoryMetadataStore } from '@/feature/repository'
import { PgJsonRepositoryAdapter } from '../PgJsonRepositoryAdapter'
import { CrudRepository, ICrudRepository } from '@/core/repository'

interface IThingData extends IEntityData {
  status?: string
  email?: string | null
  name?: string
  age?: number
}

class Thing extends Entity<IThingData> {}

@pgJsonRepository({ schema: 'wabot', table: 'thing', constructor: Thing })
class ThingRepository extends CrudRepository<Thing> {
  @query() declare findByStatus: (status: string) => Promise<Thing[]>
  @query() declare findOneByEmail: (email: string) => Promise<Thing | null>
  @query() declare countByStatusAndAge: (status: string, age: number) => Promise<number>
  @query() declare existsByName: (name: string) => Promise<boolean>
  @query() declare deleteByStatus: (status: string) => Promise<void>
  @query() declare findByEmailIsNull: () => Promise<Thing[]>
}

interface ICapturedQuery {
  sql: string
  params: any[]
}

function makeFakePool(matchers: Array<{ match: RegExp; rows: any[] }> = []) {
  const captured: ICapturedQuery[] = []
  const schemaReadyRows = [
    { column_name: 'id' },
    { column_name: 'created_at' },
    { column_name: 'data' },
  ]
  const client = {
    async query(sql: string, params: any[] = []) {
      captured.push({ sql, params })
      for (const m of matchers) {
        if (m.match.test(sql)) {
          return { rows: m.rows, rowCount: m.rows.length }
        }
      }
      if (/information_schema\.columns/.test(sql)) {
        return { rows: schemaReadyRows, rowCount: schemaReadyRows.length }
      }
      return { rows: [], rowCount: 0 }
    },
    release() {},
  }
  const pool: any = {
    async connect() {
      return client
    },
  }
  return { pool, captured }
}

function appCalls(captured: ICapturedQuery[]): ICapturedQuery[] {
  return captured.filter(
    (c) =>
      !/pg_advisory_(un)?lock/.test(c.sql) &&
      !/CREATE SCHEMA/.test(c.sql) &&
      !/CREATE TABLE/.test(c.sql) &&
      !/ALTER TABLE/.test(c.sql) &&
      !/information_schema/.test(c.sql),
  )
}

function squash(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function setupRepo(pool: any): ThingRepository {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new PgJsonRepositoryAdapter(pool))
  return new ThingRepository()
}

test.describe('@pgJsonRepository', () => {
  test('saves repository config in the metadata store', () => {
    const store = container.resolve(RepositoryMetadataStore)
    const config = store.getRepositoryConfig(ThingRepository as any)
    assert.ok(config)
    assert.equal(config!.schema, 'wabot')
    assert.equal(config!.table, 'thing')
    assert.equal(config!.constructor, Thing)
  })

  test('registers each @autoQuery method in the metadata store', () => {
    const store = container.resolve(RepositoryMetadataStore)
    const methods = store.getQueryMethods(ThingRepository as any).map((m) => m.functionName)
    for (const expected of [
      'findByStatus',
      'findOneByEmail',
      'countByStatusAndAge',
      'existsByName',
      'deleteByStatus',
      'findByEmailIsNull',
    ]) {
      assert.ok(methods.includes(expected), `${expected} should be registered`)
    }
  })

  test('installs CRUD and query methods on the prototype', () => {
    const proto = ThingRepository.prototype as any
    for (const m of ['find', 'findOrThrow', 'findByIds', 'findAll', 'create', 'update', 'delete']) {
      assert.equal(typeof proto[m], 'function', `${m} should be installed`)
    }
    for (const m of [
      'findByStatus',
      'findOneByEmail',
      'countByStatusAndAge',
      'existsByName',
      'deleteByStatus',
      'findByEmailIsNull',
    ]) {
      assert.equal(typeof proto[m], 'function', `${m} should be installed`)
    }
  })

  test('findByStatus issues SELECT with correct WHERE clause and params', async () => {
    const { pool, captured } = makeFakePool()
    const repo = setupRepo(pool)
    await repo.findByStatus('active')
    const calls = appCalls(captured)
    assert.equal(calls.length, 1)
    assert.match(squash(calls[0].sql), /WHERE data->>'status' = \$1$/)
    assert.deepEqual(calls[0].params, ['active'])
  })

  test('findOneByEmail returns first row or null', async () => {
    const { pool: pool1 } = makeFakePool([
      { match: /SELECT .* FROM "wabot"\."thing"/, rows: [{ data: { email: 'a@b.com' } }] },
    ])
    const repo1 = setupRepo(pool1)
    const r1 = await repo1.findOneByEmail('a@b.com')
    assert.equal(r1?.['data'].email, 'a@b.com')

    const { pool: pool2 } = makeFakePool()
    const repo2 = setupRepo(pool2)
    assert.equal(await repo2.findOneByEmail('missing@b.com'), null)
  })

  test('countByStatusAndAge returns count from raw row', async () => {
    const { pool } = makeFakePool([{ match: /COUNT\(\*\)/, rows: [{ count: 42 }] }])
    const repo = setupRepo(pool)
    assert.equal(await repo.countByStatusAndAge('active', 30), 42)
  })

  test('existsByName coerces raw row to boolean', async () => {
    const { pool } = makeFakePool([{ match: /EXISTS/, rows: [{ exists: true }] }])
    const repo = setupRepo(pool)
    assert.equal(await repo.existsByName('foo'), true)
  })

  test('deleteByStatus issues DELETE with correct params', async () => {
    const { pool, captured } = makeFakePool()
    const repo = setupRepo(pool)
    await repo.deleteByStatus('archived')
    const calls = appCalls(captured)
    assert.equal(calls.length, 1)
    assert.match(squash(calls[0].sql), /^DELETE FROM "wabot"\."thing" WHERE data->>'status' = \$1$/)
    assert.deepEqual(calls[0].params, ['archived'])
  })

  test('findByEmailIsNull takes zero arguments', async () => {
    const { pool, captured } = makeFakePool()
    const repo = setupRepo(pool)
    await repo.findByEmailIsNull()
    const calls = appCalls(captured)
    assert.equal(calls.length, 1)
    assert.match(squash(calls[0].sql), /WHERE data->>'email' IS NULL$/)
    assert.deepEqual(calls[0].params, [])
  })

  test('argument-count mismatch surfaces a clear error', async () => {
    const { pool } = makeFakePool()
    const repo = setupRepo(pool)
    await assert.rejects(
      () => (repo as any).countByStatusAndAge('only-one'),
      /expected 2 argument\(s\), received 1/,
    )
  })
})
