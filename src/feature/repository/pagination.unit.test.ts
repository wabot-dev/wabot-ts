import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import {
  buildPage,
  countConditionArgs,
  decodeCursor,
  encodeCursor,
  isPageOptions,
  pageInMemory,
} from './pagination'
import { IQueryCondition } from './types'

class Row extends Entity<IEntityData> {}

function row(id: string, createdAt: number): Row {
  return new Row({ id, createdAt })
}

test.describe('pagination helpers', () => {
  test.describe('cursor encode/decode', () => {
    test('round trips createdAt + id', () => {
      const cursor = encodeCursor(1723_000_000_000, 'abc')
      assert.deepEqual(decodeCursor(cursor), { createdAt: 1723_000_000_000, id: 'abc' })
    })

    test('is opaque and URL-safe (base64url, no padding chars)', () => {
      const cursor = encodeCursor(42, 'id-with/+chars')
      assert.doesNotMatch(cursor, /[+/=]/)
    })

    test('decode returns undefined for garbage', () => {
      assert.equal(decodeCursor('not-a-cursor!!!'), undefined)
      assert.equal(decodeCursor(''), undefined)
      assert.equal(decodeCursor(Buffer.from('{"x":1}').toString('base64url')), undefined)
    })
  })

  test.describe('isPageOptions', () => {
    test('accepts an object with a numeric limit', () => {
      assert.equal(isPageOptions({ limit: 10 }), true)
      assert.equal(isPageOptions({ limit: 10, cursor: 'x' }), true)
    })

    test('rejects everything else', () => {
      assert.equal(isPageOptions(undefined), false)
      assert.equal(isPageOptions(null), false)
      assert.equal(isPageOptions('active'), false)
      assert.equal(isPageOptions(10), false)
      assert.equal(isPageOptions({ cursor: 'x' }), false)
    })
  })

  test.describe('countConditionArgs', () => {
    test('counts one arg per operator, zero for null checks', () => {
      const conditions: IQueryCondition[] = [
        { field: 'status', operator: 'Equals' },
        { field: 'email', operator: 'IsNull' },
        { field: 'age', operator: 'Gt' },
      ]
      assert.equal(countConditionArgs(conditions), 2)
      assert.equal(countConditionArgs([]), 0)
    })
  })

  test.describe('buildPage', () => {
    test('no extra row → no nextCursor', () => {
      const page = buildPage([row('a', 2), row('b', 1)], 2)
      assert.equal(page.items.length, 2)
      assert.equal(page.nextCursor, undefined)
    })

    test('limit + 1 rows → drops the extra and emits a cursor for the last kept', () => {
      const page = buildPage([row('a', 3), row('b', 2), row('c', 1)], 2)
      assert.deepEqual(
        page.items.map((r) => r.id),
        ['a', 'b'],
      )
      assert.deepEqual(decodeCursor(page.nextCursor!), { createdAt: 2, id: 'b' })
    })
  })

  test.describe('pageInMemory', () => {
    test('orders by createdAt DESC then id DESC', () => {
      const page = pageInMemory([row('a', 5), row('c', 5), row('b', 9)], { limit: 10 })
      assert.deepEqual(
        page.items.map((r) => r.id),
        ['b', 'c', 'a'],
      )
      assert.equal(page.nextCursor, undefined)
    })

    test('caps at limit and advances by cursor across pages with no gaps/dupes', () => {
      const items = [row('a', 1), row('b', 2), row('c', 3), row('d', 4), row('e', 5)]
      const seen: string[] = []
      let cursor: string | undefined
      for (let i = 0; i < 10; i++) {
        const page = pageInMemory(items, { limit: 2, cursor })
        seen.push(...page.items.map((r) => r.id))
        if (!page.nextCursor) break
        cursor = page.nextCursor
      }
      // Full descending walk, every id exactly once.
      assert.deepEqual(seen, ['e', 'd', 'c', 'b', 'a'])
    })

    test('empty collection → empty page, no cursor', () => {
      const page = pageInMemory([], { limit: 5 })
      assert.deepEqual(page.items, [])
      assert.equal(page.nextCursor, undefined)
    })

    test('limit is clamped to a positive integer', () => {
      const items = [row('a', 1), row('b', 2)]
      const page = pageInMemory(items, { limit: 0 })
      assert.equal(page.items.length, 1)
      assert.ok(page.nextCursor)
    })
  })
})
