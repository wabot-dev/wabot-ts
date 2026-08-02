// What the column-storage runtime actually sends on create(), per id strategy.
// The pool is a stub that records statements, so this covers the SQL and the
// values without needing a database.

import test from 'node:test'
import assert from 'node:assert/strict'
import type { Pool } from 'pg'

import { Entity, IEntityData } from '@/core/entity'
import type { IPgRepositoryConfig } from './IPgRepositoryConfig'
import { PgSqlRepositoryBase } from './PgSqlRepositoryBase'

interface IUserData extends IEntityData {
  email?: string
}

class User extends Entity<IUserData> {}

interface IRecorded {
  sql: string
  params: any[]
}

/** A pool whose every query answers with `rows`, remembering what it was asked. */
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

function configFor(id: IPgRepositoryConfig<User>['id']): IPgRepositoryConfig<User> {
  return { table: 'users', constructor: User, fields: ['email'], id }
}

test.describe('PgColumnsRepository create() and the id strategy', () => {
  test('by default the id is generated and named in the INSERT', async () => {
    const { pool, queries } = stubPool()
    const runtime = new PgSqlRepositoryBase<User>(pool, configFor(undefined))

    const user = new User({ email: 'a@b.c' })
    await runtime.create(user)

    assert.equal(queries.length, 1)
    assert.match(queries[0].sql, /INSERT INTO "users" \("id", "created_at", "email"\)/)
    assert.doesNotMatch(queries[0].sql, /RETURNING/)
    assert.equal(queries[0].params[0], user.id)
    assert.ok(queries[0].params[1] instanceof Date, 'created_at goes out as a timestamp')
  })

  test('a function supplies the id', async () => {
    const { pool, queries } = stubPool()
    const runtime = new PgSqlRepositoryBase<User>(
      pool,
      configFor((item) => `user-${item['data'].email}`),
    )

    const user = new User({ email: 'a@b.c' })
    await runtime.create(user)

    assert.equal(user.id, 'user-a@b.c')
    assert.equal(queries[0].params[0], 'user-a@b.c')
  })

  test("id: 'database' omits the column and takes the id the table assigned", async () => {
    const { pool, queries } = stubPool([{ id: '4211' }])
    const runtime = new PgSqlRepositoryBase<User>(pool, configFor('database'))

    const user = new User({ email: 'a@b.c' })
    await runtime.create(user)

    assert.equal(
      queries[0].sql,
      'INSERT INTO "users" ("created_at", "email") VALUES ($1, $2) RETURNING id',
    )
    assert.equal(queries[0].params.length, 2, 'nothing is passed for the id')
    // Postgres hands a bigint over the wire as a string; an entity id already is one.
    assert.equal(user.id, '4211')
  })

  test("id: 'database' converts a numeric id to the string an entity carries", async () => {
    const { pool } = stubPool([{ id: 4211 }])
    const runtime = new PgSqlRepositoryBase<User>(pool, configFor('database'))

    const user = new User({ email: 'a@b.c' })
    await runtime.create(user)

    assert.equal(user.id, '4211')
  })

  test('id: { sequence } draws the number first, then inserts it', async () => {
    const { pool, queries } = stubPool([{ id: '512' }])
    const runtime = new PgSqlRepositoryBase<User>(pool, configFor({ sequence: 'legacy.users_seq' }))

    const user = new User({ email: 'a@b.c' })
    await runtime.create(user)

    assert.equal(queries.length, 2, 'one nextval, one insert')
    assert.equal(queries[0].sql, 'SELECT nextval($1::regclass)::text AS id')
    assert.deepEqual(queries[0].params, ['legacy.users_seq'], 'the name is a parameter, not SQL')
    // Known before the row exists — the point of drawing it yourself.
    assert.equal(user.id, '512')
    assert.match(queries[1].sql, /INSERT INTO "users" \("id", "created_at", "email"\)/)
    assert.doesNotMatch(queries[1].sql, /RETURNING/)
    assert.equal(queries[1].params[0], '512')
  })

  test("id: 'database' says so when the table assigned nothing", async () => {
    const { pool } = stubPool([{}])
    const runtime = new PgSqlRepositoryBase<User>(pool, configFor('database'))

    await assert.rejects(
      () => runtime.create(new User({ email: 'a@b.c' })),
      /needs the id column to assign itself/,
    )
  })

  test('restore() still inserts the id it was given, whatever the strategy', async () => {
    const { pool, queries } = stubPool()
    const runtime = new PgSqlRepositoryBase<User>(pool, configFor('database'))

    await runtime.restore(new User({ id: '77', createdAt: Date.now(), email: 'a@b.c' }))

    assert.match(queries[0].sql, /INSERT INTO "users" \("id", "created_at", "email"\)/)
    assert.equal(queries[0].params[0], '77')
  })
})
