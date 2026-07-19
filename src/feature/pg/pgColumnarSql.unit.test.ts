import test from 'node:test'
import assert from 'node:assert/strict'

import {
  columnarColumns,
  columnarInsertSql,
  columnarSelectList,
  columnarUpdateSql,
} from './pgColumnarSql'

test.describe('pgColumnarSql', () => {
  test('columnarColumns prepends id + created_at and quotes identifiers', () => {
    assert.deepEqual(columnarColumns(['email', 'age']), [
      '"id"',
      '"created_at"',
      '"email"',
      '"age"',
    ])
  })

  test('columnarSelectList joins the quoted columns', () => {
    assert.equal(columnarSelectList(['email']), '"id", "created_at", "email"')
  })

  test('columnarInsertSql lists columns and positional params in order', () => {
    assert.equal(
      columnarInsertSql('"app"."users"', ['email', 'age']),
      'INSERT INTO "app"."users" ("id", "created_at", "email", "age") VALUES ($1, $2, $3, $4)',
    )
  })

  test('columnarUpdateSql updates only field columns; id is the last param', () => {
    assert.equal(
      columnarUpdateSql('"users"', ['email', 'age']),
      'UPDATE "users" SET "email" = $1, "age" = $2 WHERE id = $3',
    )
  })

  test('columnarUpdateSql returns null when there are no mutable columns', () => {
    assert.equal(columnarUpdateSql('"users"', []), null)
  })

  test('identifiers with double quotes are escaped', () => {
    assert.deepEqual(columnarColumns(['we"ird']), ['"id"', '"created_at"', '"we""ird"'])
  })
})
