import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveIndexes, mergeIndexes, IIndexDecl } from './indexes'
import { parseQueryMethodName } from './parseQueryMethodName'

const derive = (...methods: string[]) => deriveIndexes(methods.map((m) => parseQueryMethodName(m)))

const byField = (decls: IIndexDecl[]) => new Map(decls.map((d) => [d.fields.join(','), d.kind]))

test.describe('deriveIndexes', () => {
  test('equality query → exact index on the field', () => {
    const m = byField(derive('findByStatus'))
    assert.equal(m.get('status'), 'exact')
  })

  test('comparison query → range index', () => {
    const m = byField(derive('findByAgeGreaterThan'))
    assert.equal(m.get('age'), 'range')
  })

  test('LIKE query → text index', () => {
    const m = byField(derive('findByNameLike'))
    assert.equal(m.get('name'), 'text')
  })

  test('ORDER BY field → range index', () => {
    const m = byField(derive('findAllOrderByCreatedAtDesc'))
    assert.equal(m.get('createdAt'), 'range')
  })

  test('a field used both for equality and comparison → range (btree serves both)', () => {
    const m = byField(derive('findByAge', 'findByAgeGreaterThan'))
    assert.equal(m.get('age'), 'range')
  })

  test('id is never indexed (it is the primary key)', () => {
    const m = byField(derive('findById'))
    assert.equal(m.has('id'), false)
  })

  test('dedupes fields across many query methods', () => {
    const decls = derive('findByStatus', 'countByStatus', 'existsByStatus')
    assert.equal(decls.filter((d) => d.fields.join(',') === 'status').length, 1)
  })
})

test.describe('mergeIndexes', () => {
  test('keeps auto indexes that have no explicit counterpart', () => {
    const merged = mergeIndexes([], [{ fields: ['status'], kind: 'exact' }])
    assert.equal(merged.length, 1)
    assert.equal(merged[0].fields[0], 'status')
  })

  test('explicit declaration overrides the auto one for the same fields', () => {
    const merged = mergeIndexes(
      [{ fields: ['status'], kind: 'contains' }],
      [{ fields: ['status'], kind: 'exact' }],
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0].kind, 'contains')
  })

  test('disabled explicit entry opts out of the auto index entirely', () => {
    const merged = mergeIndexes(
      [{ fields: ['status'], disabled: true }],
      [{ fields: ['status'], kind: 'exact' }],
    )
    assert.equal(merged.length, 0)
  })

  test('explicit and auto for different fields both survive', () => {
    const merged = mergeIndexes(
      [{ fields: ['email'], kind: 'exact', unique: true }],
      [{ fields: ['status'], kind: 'exact' }],
    )
    assert.deepEqual(merged.map((d) => d.fields[0]).sort(), ['email', 'status'])
  })
})
