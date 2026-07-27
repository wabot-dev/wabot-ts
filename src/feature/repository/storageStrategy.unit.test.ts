import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { CrudRepository, storageOf } from '@/core/repository'
import { PgColumnsRepository, PgColumnsRepositoryExtension, PgJsonbRepository } from '@/feature/pg'
import { PgJsonbRepositoryExtension } from '@/feature/pg'
import { dbExtension } from './@dbExtension'
import { repository } from './@repository'

interface IUserData extends IEntityData {
  email?: string
  name?: string
}
class User extends Entity<IUserData> {}

@repository({ table: 'user_columns', constructor: User })
class ColumnUserRepository extends PgColumnsRepository<User> {}

@repository({ table: 'user_jsonb', constructor: User })
class JsonbUserRepository extends PgJsonbRepository<User> {}

@repository({ table: 'user_plain', constructor: User })
class PlainUserRepository extends CrudRepository<User> {}

test.describe('storage declared by the repository class', () => {
  test('an engine base declares its engine and strategy', () => {
    assert.deepEqual(storageOf(ColumnUserRepository), {
      engine: storageOf(PgColumnsRepository)!.engine,
      strategy: 'columns',
    })
    assert.equal(storageOf(JsonbUserRepository)?.strategy, 'jsonb')
  })

  test('a plain CrudRepository declares nothing, so the backend decides', () => {
    assert.equal(storageOf(PlainUserRepository), undefined)
  })

  test('the declaration survives a deeper hierarchy', () => {
    class Intermediate extends PgColumnsRepository<User> {}
    class Leaf extends Intermediate {}
    assert.equal(storageOf(Leaf)?.strategy, 'columns')
  })
})

test.describe('@dbExtension cross-checks the strategy at import time', () => {
  test('an extension of the same strategy registers', () => {
    assert.doesNotThrow(() => {
      class ColumnQueries extends PgColumnsRepositoryExtension<User> {}
      dbExtension(ColumnUserRepository as any)(ColumnQueries as any)
    })
  })

  test('an extension of the other strategy is refused', () => {
    class JsonbQueries extends PgJsonbRepositoryExtension<User> {}
    assert.throws(
      () => dbExtension(ColumnUserRepository as any)(JsonbQueries as any),
      /declares pg\/columns storage, but this extension serves pg\/jsonb/,
    )
  })

  test('a repository that declares nothing accepts either extension', () => {
    assert.doesNotThrow(() => {
      class JsonbQueries extends PgJsonbRepositoryExtension<User> {}
      dbExtension(PlainUserRepository as any)(JsonbQueries as any)
    })
  })
})
