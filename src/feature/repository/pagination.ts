import { Entity, IEntityData } from '@/core/entity'
import { IPage, IPageOptions } from '@/core/repository'
import { IQueryCondition } from './types'

export type { IPage, IPageOptions } from '@/core/repository'

export function isPageOptions(value: unknown): value is IPageOptions {
  return (
    typeof value === 'object' && value !== null && typeof (value as IPageOptions).limit === 'number'
  )
}

/** Keyset position: an entity's createdAt (epoch ms) + id, the stable sort tuple. */
export interface ICursor {
  createdAt: number
  id: string
}

/** Encode a keyset position into an opaque, URL-safe cursor. */
export function encodeCursor(createdAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt, i: id })).toString('base64url')
}

/** Decode a cursor; returns undefined for a malformed/foreign value (treat as first page). */
export function decodeCursor(cursor: string): ICursor | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'))
    if (typeof parsed?.c === 'number' && typeof parsed?.i === 'string') {
      return { createdAt: parsed.c, id: parsed.i }
    }
  } catch {
    // malformed cursor → treated as no cursor
  }
  return undefined
}

/** Positional args the conditions consume (IsNull/IsNotNull take none). */
export function countConditionArgs(conditions: IQueryCondition[]): number {
  return conditions.reduce(
    (n, c) => n + (c.operator === 'IsNull' || c.operator === 'IsNotNull' ? 0 : 1),
    0,
  )
}

/**
 * Turn `limit + 1` fetched rows (already ordered created_at DESC, id DESC) into a
 * page: the extra row signals a next page, whose cursor is the last kept item.
 */
export function buildPage<P extends Entity<IEntityData>>(rows: P[], limit: number): IPage<P> {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt.getTime(), last.id) : undefined
  return { items, nextCursor }
}

/**
 * Keyset-page an in-memory collection: sort by `createdAt DESC, id DESC` (same
 * order the SQL runtimes use), drop everything up to and including the cursor,
 * then return one page. Items are returned as-is (no cloning).
 */
export function pageInMemory<P extends Entity<IEntityData>>(
  items: Iterable<P>,
  options: IPageOptions,
): IPage<P> {
  const limit = Math.max(1, Math.floor(options.limit))
  const cursor = options.cursor ? decodeCursor(options.cursor) : undefined
  let sorted = [...items].sort((a, b) => {
    const ac = a['data'].createdAt ?? 0
    const bc = b['data'].createdAt ?? 0
    if (ac !== bc) return bc - ac
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  })
  if (cursor) {
    sorted = sorted.filter((item) => {
      const c = item['data'].createdAt ?? 0
      if (c !== cursor.createdAt) return c < cursor.createdAt
      return item.id < cursor.id
    })
  }
  return buildPage(sorted.slice(0, limit + 1), limit)
}
