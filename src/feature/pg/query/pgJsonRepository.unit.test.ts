import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { pgJsonRepository } from './@pgJsonRepository'
import { query } from './@query'
import { PgJsonRepository } from './PgJsonRepository'
import { PgRepositoryMetadataStore } from './PgRepositoryMetadataStore'

interface IThingData extends IEntityData {
  status?: string
  email?: string | null
  name?: string
  age?: number
}

class Thing extends Entity<IThingData> {}

@pgJsonRepository({ schema: 'wabot', table: 'thing', constructor: Thing })
class TestThingRepository extends PgJsonRepository<Thing> {
  @query() declare findByStatus: (status: string) => Promise<Thing[]>
  @query() declare findOneByEmail: (email: string) => Promise<Thing | null>
  @query() declare countByStatusAndAge: (status: string, age: number) => Promise<number>
  @query() declare existsByName: (name: string) => Promise<boolean>
  @query() declare deleteByStatus: (status: string) => Promise<void>
  @query() declare findByEmailIsNull: () => Promise<Thing[]>
}

interface ICapturedCall {
  kind: 'query' | 'exec' | 'rawQuery'
  sql: string
  params: any[]
}

interface IFakeRow {
  count?: number
  exists?: boolean
}

class FakeClient {
  constructor(private rows: IFakeRow[]) {}
  async query(_sql: string, _params: any[]) {
    return { rows: this.rows, rowCount: this.rows.length }
  }
}

function makeStub(opts: { entities?: Thing[]; rawRows?: IFakeRow[] } = {}) {
  const calls: ICapturedCall[] = []
  const proto: any = TestThingRepository.prototype
  const fakeClient = new FakeClient(opts.rawRows ?? [])
  const stub: any = {
    table: '"wabot"."thing"',
    columns: '"id", "created_at", "data"',
    pool: {
      /* sentinel; never connected */
    },
    async query(sql: string, params: any[]) {
      calls.push({ kind: 'query', sql, params })
      return opts.entities ?? []
    },
    async exec(sql: string, params: any[]) {
      calls.push({ kind: 'exec', sql, params })
    },
    async ensureTable() {
      /* no-op */
    },
  }
  // Re-bind every prototype method onto stub for this scenario
  Object.setPrototypeOf(stub, proto)
  return { stub, calls, fakeClient }
}

function squash(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

test.describe('@pgJsonRepository + @query', () => {
  test('saves repository config in the metadata store', () => {
    const store = container.resolve(PgRepositoryMetadataStore)
    const config = store.getRepositoryConfig(TestThingRepository as any)
    assert.ok(config, 'repository config should be saved')
    assert.equal(config!.schema, 'wabot')
    assert.equal(config!.table, 'thing')
    assert.equal(config!.constructor, Thing)
  })

  test('registers each @query method in the metadata store', () => {
    const store = container.resolve(PgRepositoryMetadataStore)
    const methods = store.getQueryMethods(TestThingRepository as any).map((m) => m.functionName)
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

  test('installs query methods on the prototype', () => {
    const proto = TestThingRepository.prototype as any
    assert.equal(typeof proto.findByStatus, 'function')
    assert.equal(typeof proto.findOneByEmail, 'function')
    assert.equal(typeof proto.countByStatusAndAge, 'function')
    assert.equal(typeof proto.existsByName, 'function')
    assert.equal(typeof proto.deleteByStatus, 'function')
    assert.equal(typeof proto.findByEmailIsNull, 'function')
  })

  test('find* delegates to this.query with correct SQL and params', async () => {
    const expected = [new Thing({ status: 'active' } as any)]
    const { stub, calls } = makeStub({ entities: expected })
    const result = await stub.findByStatus('active')
    assert.equal(result, expected)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].kind, 'query')
    assert.match(squash(calls[0].sql), /WHERE data->>'status' = \$1$/)
    assert.deepEqual(calls[0].params, ['active'])
  })

  test('findOne* returns first row or null', async () => {
    const only = new Thing({ email: 'a@b.com' } as any)
    const { stub: stub1 } = makeStub({ entities: [only] })
    assert.equal(await stub1.findOneByEmail('a@b.com'), only)

    const { stub: stub2 } = makeStub({ entities: [] })
    assert.equal(await stub2.findOneByEmail('missing@b.com'), null)
  })

  test('count* runs raw SQL via the pool client and returns count', async () => {
    const { stub, fakeClient } = makeStub({ rawRows: [{ count: 42 }] })
    // Force withPgClient to use our fake client by stubbing pool.connect.
    let releaseCalls = 0
    stub.pool = {
      async connect() {
        return Object.assign(fakeClient, {
          release() {
            releaseCalls += 1
          },
        })
      },
    }
    const n = await stub.countByStatusAndAge('active', 30)
    assert.equal(n, 42)
    assert.equal(releaseCalls, 1)
  })

  test('exists* runs raw SQL and coerces to boolean', async () => {
    const { stub, fakeClient } = makeStub({ rawRows: [{ exists: true }] })
    stub.pool = {
      async connect() {
        return Object.assign(fakeClient, { release() {} })
      },
    }
    const r = await stub.existsByName('foo')
    assert.equal(r, true)
  })

  test('delete* delegates to this.exec', async () => {
    const { stub, calls } = makeStub()
    await stub.deleteByStatus('archived')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].kind, 'exec')
    assert.match(squash(calls[0].sql), /^DELETE FROM "wabot"\."thing" WHERE data->>'status' = \$1$/)
    assert.deepEqual(calls[0].params, ['archived'])
  })

  test('IsNull conditions take zero arguments', async () => {
    const { stub, calls } = makeStub({ entities: [] })
    await stub.findByEmailIsNull()
    assert.equal(calls.length, 1)
    assert.match(squash(calls[0].sql), /WHERE data->>'email' IS NULL$/)
    assert.deepEqual(calls[0].params, [])
  })

  test('argument-count mismatch surfaces a clear error', async () => {
    const { stub } = makeStub({ entities: [] })
    await assert.rejects(
      () => stub.countByStatusAndAge('only-one' as any),
      /expected 2 argument\(s\), received 1/,
    )
  })
})

test.describe('invalid @query method names', () => {
  test('throws at decoration time when method name does not match grammar', () => {
    assert.throws(() => {
      class _Bad extends PgJsonRepository<Thing> {
        @query() declare fetchByName: () => Promise<unknown>
      }
      @pgJsonRepository({ schema: 's', table: 't', constructor: Thing })
      class _BadRepo extends _Bad {}
      // reference to avoid unused warnings
      void _BadRepo
    }, /must start with one of/)
  })
})

test.describe('@pgJsonRepository extends check', () => {
  test('throws when target does not extend PgJsonRepository', () => {
    assert.throws(() => {
      @pgJsonRepository({ schema: 's', table: 't', constructor: Thing })
      class _NotARepo {}
      void _NotARepo
    }, /must extend PgJsonRepository/)
  })
})
