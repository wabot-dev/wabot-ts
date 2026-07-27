import test from 'node:test'
import assert from 'node:assert/strict'

import { parseQueryMethodName } from '@/feature/repository'
import { buildPageSql } from './pgPageSql'

const TABLE = '"public"."thing"'
const COLUMNS = '"id", "created_at", "data"'

function squash(sql: string) {
  return sql.replace(/\s+/g, ' ').trim()
}

function conditionsOf(methodName: string) {
  return parseQueryMethodName(methodName).conditions
}

test.describe('buildPageSql', () => {
  test('no conditions, no cursor → plain keyset order + LIMIT limit+1', () => {
    const built = buildPageSql(TABLE, COLUMNS, [], [], { limit: 20 })
    assert.equal(
      squash(built.sql),
      `SELECT ${COLUMNS} FROM ${TABLE} ORDER BY created_at DESC, id DESC LIMIT 21`,
    )
    assert.deepEqual(built.buildParams([]), [])
  })

  test('no conditions, with cursor → WHERE row-value comparison, cursor params appended', () => {
    const at = new Date('2024-01-01T00:00:00Z')
    const built = buildPageSql(TABLE, COLUMNS, [], [], {
      cursorCreatedAt: at,
      cursorId: 'abc',
      limit: 5,
    })
    assert.equal(
      squash(built.sql),
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE (created_at, id) < ($1, $2) ` +
        `ORDER BY created_at DESC, id DESC LIMIT 6`,
    )
    assert.deepEqual(built.buildParams([]), [at, 'abc'])
  })

  test('with conditions, no cursor → conditions WHERE only', () => {
    const built = buildPageSql(TABLE, COLUMNS, conditionsOf('findByStatus'), [], { limit: 10 })
    assert.equal(
      squash(built.sql),
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE data->>'status' = $1 ` +
        `ORDER BY created_at DESC, id DESC LIMIT 11`,
    )
    assert.deepEqual(built.buildParams(['active']), ['active'])
  })

  test('with conditions + cursor → keyset ANDed after conditions, params offset correctly', () => {
    const at = new Date('2024-06-01T12:00:00Z')
    const built = buildPageSql(TABLE, COLUMNS, conditionsOf('findByStatus'), [], {
      cursorCreatedAt: at,
      cursorId: 'zzz',
      limit: 3,
    })
    assert.equal(
      squash(built.sql),
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE data->>'status' = $1 AND (created_at, id) < ($2, $3) ` +
        `ORDER BY created_at DESC, id DESC LIMIT 4`,
    )
    assert.deepEqual(built.buildParams(['active']), ['active', at, 'zzz'])
  })

  test('limit is clamped to a positive integer (LIMIT limit+1)', () => {
    const built = buildPageSql(TABLE, COLUMNS, [], [], { limit: 0 })
    assert.match(built.sql, /LIMIT 2$/)
  })
})
