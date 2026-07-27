import test from 'node:test'
import assert from 'node:assert/strict'
import type { Pool } from 'pg'

import { PgRepositoryAdapter } from './PgJsonRepositoryAdapter'
import { PgSqlRepositoryBase, PgSqlRepositoryExtension } from './PgSqlRepositoryBase'
import { PgJsonbRepositoryExtension } from './PgRepositoryExtension'
import type { IRepositoryConfig } from '@/feature/repository'
import { storageOf } from '@/core/repository'
import { Entity, IEntityData } from '@/core/entity'
import { PgColumnsRepository } from './PgColumnsRepository'
import { PgJsonbRepository } from './PgJsonbRepository'

// The runtimes only touch the pool when a query runs; a stub is enough to build.
const fakePool = {} as unknown as Pool

class DummyEntity extends Entity<IEntityData> {}

const config: IRepositoryConfig<DummyEntity> = {
  table: 'items',
  constructor: DummyEntity,
}

class JsonExtension extends PgJsonbRepositoryExtension<DummyEntity> {}
class SqlExtension extends PgSqlRepositoryExtension<DummyEntity> {}

const MONGO_ENGINE = Symbol('mongo')
const mongoStorage = { engine: MONGO_ENGINE, strategy: 'document' }

test.describe('PgRepositoryAdapter strategy selection', () => {
  const adapter = new PgRepositoryAdapter(fakePool)

  test('a repository that declares nothing → JSONB runtime (default)', () => {
    const runtime = adapter.build(config)
    assert.equal(runtime instanceof PgSqlRepositoryBase, false)
  })

  test('a repository extending PgColumnsRepository → column runtime', () => {
    const runtime = adapter.build(config, undefined, storageOf(PgColumnsRepository))
    assert.equal(runtime instanceof PgSqlRepositoryBase, true)
  })

  test('a repository extending PgJsonbRepository → JSONB runtime', () => {
    const runtime = adapter.build(config, undefined, storageOf(PgJsonbRepository))
    assert.equal(runtime instanceof PgSqlRepositoryBase, false)
  })

  test('what the repository declares wins over the extension base', () => {
    const runtime = adapter.build(config, SqlExtension, storageOf(PgJsonbRepository))
    assert.equal(runtime instanceof PgSqlRepositoryBase, false)
  })

  test('a repository declaring another engine is refused, not served by default', () => {
    assert.throws(
      () => adapter.build(config, undefined, mongoStorage),
      /declares mongo\/document storage, but the active backend is Postgres/,
    )
  })

  test.describe('without a declaration, the extension base still decides (legacy)', () => {
    test('extension extending the JSONB base → JSONB runtime', () => {
      const runtime = adapter.build(config, JsonExtension)
      assert.equal(runtime instanceof PgSqlRepositoryBase, false)
    })

    test('extension extending the column base → column runtime', () => {
      const runtime = adapter.build(config, SqlExtension)
      assert.equal(runtime instanceof PgSqlRepositoryBase, true)
    })
  })
})

test.describe('PgRepositoryAdapter.buildExtension', () => {
  const adapter = new PgRepositoryAdapter(fakePool)

  test('builds an extension of its own engine', () => {
    assert.ok(adapter.buildExtension(config, JsonExtension) instanceof JsonExtension)
  })

  test('refuses an extension belonging to another engine', () => {
    class MongoExtension {
      static readonly storage = mongoStorage
    }
    assert.throws(
      () => adapter.buildExtension(config, MongoExtension),
      /is an extension for mongo\/document, but the active backend is Postgres/,
    )
  })
})
