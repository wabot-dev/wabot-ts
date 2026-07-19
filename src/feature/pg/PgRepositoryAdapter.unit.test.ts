import test from 'node:test'
import assert from 'node:assert/strict'
import type { Pool } from 'pg'

import { PgRepositoryAdapter } from './PgJsonRepositoryAdapter'
import { PgSqlRepositoryBase, PgSqlRepositoryExtension } from './PgSqlRepositoryBase'
import { PgJsonbRepositoryExtension } from './PgRepositoryExtension'
import type { IRepositoryConfig } from '@/feature/repository'
import { Entity, IEntityData } from '@/core/entity'

// The runtimes only touch the pool when a query runs; a stub is enough to build.
const fakePool = {} as unknown as Pool

class DummyEntity extends Entity<IEntityData> {}

const config: IRepositoryConfig<DummyEntity> = {
  table: 'items',
  constructor: DummyEntity,
}

class JsonExtension extends PgJsonbRepositoryExtension<DummyEntity> {}
class SqlExtension extends PgSqlRepositoryExtension<DummyEntity> {}

test.describe('PgRepositoryAdapter strategy selection', () => {
  const adapter = new PgRepositoryAdapter(fakePool)

  test('no db extension → JSONB runtime (default)', () => {
    const runtime = adapter.build(config)
    assert.equal(runtime instanceof PgSqlRepositoryBase, false)
  })

  test('extension extending the JSONB base → JSONB runtime', () => {
    const runtime = adapter.build(config, JsonExtension)
    assert.equal(runtime instanceof PgSqlRepositoryBase, false)
  })

  test('extension extending PgSqlRepositoryExtension → relational runtime', () => {
    const runtime = adapter.build(config, SqlExtension)
    assert.equal(runtime instanceof PgSqlRepositoryBase, true)
  })
})
