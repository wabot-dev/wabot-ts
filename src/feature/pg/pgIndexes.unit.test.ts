import test from 'node:test'
import assert from 'node:assert/strict'

import { buildIndexDdl } from './pgIndexes'

const TABLE = '"public"."users"'
const NAME = 'users'
const NO_PROMOTED = new Set<string>()

test.describe('buildIndexDdl', () => {
  test('exact on a JSON field → btree on the data->> expression', () => {
    const ddl = buildIndexDdl(TABLE, NAME, { fields: ['status'], kind: 'exact' }, NO_PROMOTED)
    assert.match(
      ddl!,
      /^CREATE INDEX IF NOT EXISTS "[^"]+" ON "public"\."users" \(\(data->>'status'\)\)$/,
    )
  })

  test('exact on a promoted field → btree on the native column', () => {
    const ddl = buildIndexDdl(
      TABLE,
      NAME,
      { fields: ['status'], kind: 'exact' },
      new Set(['status']),
    )
    assert.match(ddl!, /ON "public"\."users" \("status"\)$/)
  })

  test('reserved field createdAt → created_at column', () => {
    const ddl = buildIndexDdl(TABLE, NAME, { fields: ['createdAt'], kind: 'range' }, NO_PROMOTED)
    assert.match(ddl!, /\("created_at"\)$/)
  })

  test('unique flag → CREATE UNIQUE INDEX', () => {
    const ddl = buildIndexDdl(
      TABLE,
      NAME,
      { fields: ['email'], kind: 'exact', unique: true },
      NO_PROMOTED,
    )
    assert.match(ddl!, /^CREATE UNIQUE INDEX IF NOT EXISTS /)
  })

  test('contains → GIN over data jsonb_path_ops', () => {
    const ddl = buildIndexDdl(TABLE, NAME, { fields: ['tags'], kind: 'contains' }, NO_PROMOTED)
    assert.match(ddl!, /USING gin \(data jsonb_path_ops\)$/)
  })

  test('composite index → both elements in the target', () => {
    const ddl = buildIndexDdl(
      TABLE,
      NAME,
      { fields: ['status', 'kind'], kind: 'exact' },
      NO_PROMOTED,
    )
    assert.match(ddl!, /\(\(data->>'status'\), \(data->>'kind'\)\)$/)
  })

  test('index name is deterministic for the same declaration', () => {
    const a = buildIndexDdl(TABLE, NAME, { fields: ['status'], kind: 'exact' }, NO_PROMOTED)
    const b = buildIndexDdl(TABLE, NAME, { fields: ['status'], kind: 'exact' }, NO_PROMOTED)
    assert.equal(a, b)
  })

  test('index name stays within Postgres 63-byte limit for long fields', () => {
    const longField = 'a'.repeat(80)
    const ddl = buildIndexDdl(TABLE, NAME, { fields: [longField], kind: 'exact' }, NO_PROMOTED)
    const name = ddl!.match(/IF NOT EXISTS "([^"]+)"/)![1]
    assert.ok(name.length <= 63, `index name ${name.length} bytes`)
  })

  test('btree declaration with no fields → null', () => {
    const ddl = buildIndexDdl(TABLE, NAME, { fields: [], kind: 'exact' }, NO_PROMOTED)
    assert.equal(ddl, null)
  })
})
