import test from 'node:test'
import assert from 'node:assert/strict'

import { buildQuerySql } from './buildQuerySql'
import { parseQueryMethodName } from '@/feature/repository'

const TABLE = '"public"."job"'
const COLUMNS = '"id", "created_at", "data"'

function build(methodName: string) {
  return buildQuerySql(parseQueryMethodName(methodName), TABLE, COLUMNS)
}

function squash(sql: string) {
  return sql.replace(/\s+/g, ' ').trim()
}

test.describe('buildQuerySql', () => {
  test.describe('SELECT (find)', () => {
    test('findAll → no WHERE', () => {
      const r = build('findAll')
      assert.equal(squash(r.sql), `SELECT ${COLUMNS} FROM ${TABLE}`)
      assert.equal(r.argCount, 0)
    })

    test('findByName → equality WHERE', () => {
      const r = build('findByName')
      assert.equal(squash(r.sql), `SELECT ${COLUMNS} FROM ${TABLE} WHERE data->>'name' = $1`)
      assert.equal(r.argCount, 1)
    })

    test('findOneByEmail → adds LIMIT 1', () => {
      const r = build('findOneByEmail')
      assert.match(r.sql, /LIMIT 1$/)
      assert.equal(r.argCount, 1)
    })

    test('findByStatusAndType → AND join', () => {
      const r = build('findByStatusAndType')
      assert.equal(
        squash(r.sql),
        `SELECT ${COLUMNS} FROM ${TABLE} WHERE data->>'status' = $1 AND data->>'type' = $2`,
      )
      assert.equal(r.argCount, 2)
    })

    test('findByStatusOrType → OR join', () => {
      const r = build('findByStatusOrType')
      assert.match(r.sql, /WHERE data->>'status' = \$1 OR data->>'type' = \$2/)
    })

    test('findByNameLike → LIKE', () => {
      const r = build('findByNameLike')
      assert.match(r.sql, /data->>'name' LIKE \$1/)
    })

    test('findByStatusIn → ANY array', () => {
      const r = build('findByStatusIn')
      assert.match(r.sql, /data->>'status' = ANY\(\$1::text\[\]\)/)
    })

    test('findByStatusNotIn → NOT ANY', () => {
      const r = build('findByStatusNotIn')
      assert.match(r.sql, /NOT \(data->>'status' = ANY\(\$1::text\[\]\)\)/)
    })

    test('findByAgeGreaterThan → numeric cast on both sides', () => {
      const r = build('findByAgeGreaterThan')
      assert.match(r.sql, /\(data->>'age'\)::numeric > \$1::numeric/)
    })

    test('findByAgeLessThanEqual → ::numeric <=', () => {
      const r = build('findByAgeLessThanEqual')
      assert.match(r.sql, /\(data->>'age'\)::numeric <= \$1::numeric/)
    })

    test('findByEmailIsNull → IS NULL, no params', () => {
      const r = build('findByEmailIsNull')
      assert.match(r.sql, /data->>'email' IS NULL/)
      assert.equal(r.argCount, 0)
    })

    test('findByEmailIsNotNull → IS NOT NULL, no params', () => {
      const r = build('findByEmailIsNotNull')
      assert.match(r.sql, /data->>'email' IS NOT NULL/)
      assert.equal(r.argCount, 0)
    })

    test('mixed Not + IsNull → arity counts only non-null operands', () => {
      const r = build('findByStatusNotAndEmailIsNull')
      assert.match(r.sql, /data->>'status' <> \$1 AND data->>'email' IS NULL/)
      assert.equal(r.argCount, 1)
    })

    test('OrderBy DESC + Limit (createdAt routed to indexed column)', () => {
      const r = build('findByStatusOrderByCreatedAtDescLimit10')
      assert.match(r.sql, /ORDER BY created_at DESC LIMIT 10$/)
    })

    test('multiple OrderBy fields (createdAt routed, other field via JSON)', () => {
      const r = build('findAllOrderByCreatedAtDescNameAsc')
      assert.match(r.sql, /ORDER BY created_at DESC, data->>'name' ASC$/)
    })

    test('findById uses the id column, not data->>id', () => {
      const r = build('findById')
      assert.match(squash(r.sql), /WHERE id = \$1$/)
      assert.equal(r.argCount, 1)
    })

    test('findByCreatedAtGreaterThan uses created_at column without numeric cast', () => {
      const r = build('findByCreatedAtGreaterThan')
      assert.match(r.sql, /WHERE created_at > \$1$/)
      assert.equal(r.argCount, 1)
    })
  })

  test.describe('count', () => {
    test('countByStatus', () => {
      const r = build('countByStatus')
      assert.equal(
        squash(r.sql),
        `SELECT COUNT(*)::int AS count FROM ${TABLE} WHERE data->>'status' = $1`,
      )
      assert.equal(r.argCount, 1)
    })
  })

  test.describe('exists', () => {
    test('existsByEmail', () => {
      const r = build('existsByEmail')
      assert.equal(
        squash(r.sql),
        `SELECT EXISTS(SELECT 1 FROM ${TABLE} WHERE data->>'email' = $1 LIMIT 1) AS "exists"`,
      )
      assert.equal(r.argCount, 1)
    })
  })

  test.describe('delete', () => {
    test('deleteByStatus', () => {
      const r = build('deleteByStatus')
      assert.equal(squash(r.sql), `DELETE FROM ${TABLE} WHERE data->>'status' = $1`)
      assert.equal(r.argCount, 1)
    })
  })

  test.describe('promoted columns (index-aware routing)', () => {
    const buildPromoted = (methodName: string, promoted: string[]) =>
      buildQuerySql(parseQueryMethodName(methodName), TABLE, COLUMNS, promoted)

    test('equality on a promoted field uses the native column, not data->>', () => {
      const r = buildPromoted('findByStatus', ['status'])
      assert.match(squash(r.sql), /WHERE "status" = \$1$/)
    })

    test('range on a promoted field drops the ::numeric casts', () => {
      const r = buildPromoted('findByAgeGreaterThan', ['age'])
      assert.match(r.sql, /WHERE "age" > \$1$/)
    })

    test('In on a promoted field drops the ::text[] cast', () => {
      const r = buildPromoted('findByStatusIn', ['status'])
      assert.match(r.sql, /WHERE "status" = ANY\(\$1\)$/)
    })

    test('ORDER BY on a promoted field uses the native column', () => {
      const r = buildPromoted('findAllOrderByStatusDesc', ['status'])
      assert.match(r.sql, /ORDER BY "status" DESC$/)
    })

    test('non-promoted fields still fall back to data->>', () => {
      const r = buildPromoted('findByStatusAndType', ['status'])
      assert.match(squash(r.sql), /WHERE "status" = \$1 AND data->>'type' = \$2$/)
    })
  })

  test.describe("'all' columns (column storage with no fields projection)", () => {
    const buildAll = (methodName: string) =>
      buildQuerySql(parseQueryMethodName(methodName), TABLE, '*', 'all')

    test('every field is a column: nothing falls back to data->>', () => {
      // There is no `data` blob in this strategy, so a JSON extraction here
      // would be invalid SQL rather than a slow query.
      const r = buildAll('findByStatusAndType')
      assert.match(squash(r.sql), /WHERE "status" = \$1 AND "type" = \$2$/)
      assert.doesNotMatch(r.sql, /data->>/)
    })

    test('comparisons keep the column type, with no ::numeric cast', () => {
      const r = buildAll('findByAgeGreaterThan')
      assert.match(r.sql, /WHERE "age" > \$1$/)
    })

    test('ORDER BY sorts on the column, not on text', () => {
      const r = buildAll('findAllOrderByAgeDesc')
      assert.match(r.sql, /ORDER BY "age" DESC$/)
    })
  })

  test.describe('buildParams arg validation', () => {
    test('passes through correct argument count', () => {
      const r = build('findByStatusAndType')
      assert.deepEqual(r.buildParams(['active', 'priority']), ['active', 'priority'])
    })

    test('throws on argument count mismatch', () => {
      const r = build('findByStatusAndType')
      assert.throws(() => r.buildParams(['only-one']), /expected 2 argument\(s\), received 1/)
    })

    test('zero args for IsNull-only conditions', () => {
      const r = build('findByEmailIsNull')
      assert.deepEqual(r.buildParams([]), [])
      assert.throws(() => r.buildParams(['x']), /expected 0 argument\(s\), received 1/)
    })
  })
})
