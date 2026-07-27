import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { repository } from './@repository'
import { query } from './@query'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'
import { IPage, IPageOptions } from './pagination'

interface IThingData extends IEntityData {
  status?: string
  name?: string
}

class Thing extends Entity<IThingData> {}

@repository({ table: 'thing', constructor: Thing })
class ThingRepository {
  declare create: (item: Thing) => Promise<void>
  declare findPage: (options: IPageOptions) => Promise<IPage<Thing>>

  // A trailing IPageOptions switches the query method to keyset pagination.
  @query() declare findByStatus: {
    (status: string): Promise<Thing[]>
    (status: string, options: IPageOptions): Promise<IPage<Thing>>
  }
}

function newRepo(): ThingRepository {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new MemoryRepositoryAdapter({ persist: false, maxItems: 1000 }))
  return new ThingRepository()
}

async function seed(repo: ThingRepository, statuses: string[]): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const [i, status] of statuses.entries()) {
    const t = new Thing({ status, name: `t${i}` })
    await repo.create(t)
    ids.add(t.id)
  }
  return ids
}

// Walk every page and return the ids seen, asserting each page respects the limit.
async function walk(
  next: (cursor?: string) => Promise<IPage<Thing>>,
  limit: number,
): Promise<string[]> {
  const seen: string[] = []
  let cursor: string | undefined
  for (let guard = 0; guard < 100; guard++) {
    const page = await next(cursor)
    assert.ok(page.items.length <= limit, `page over limit: ${page.items.length} > ${limit}`)
    seen.push(...page.items.map((t) => t.id))
    if (!page.nextCursor) return seen
    cursor = page.nextCursor
  }
  throw new Error('walk did not terminate')
}

test.describe('findPage + paginated queries (memory)', () => {
  test('findPage walks all entities exactly once with no gaps or dupes', async () => {
    const repo = newRepo()
    const ids = await seed(
      repo,
      Array.from({ length: 5 }, () => 'active'),
    )

    const seen = await walk((cursor) => repo.findPage({ limit: 2, cursor }), 2)

    assert.equal(seen.length, ids.size, 'no duplicates across pages')
    assert.deepEqual(new Set(seen), ids, 'every entity visited')
  })

  test('findPage on an empty repo → empty page, no cursor', async () => {
    const repo = newRepo()
    const page = await repo.findPage({ limit: 10 })
    assert.deepEqual(page.items, [])
    assert.equal(page.nextCursor, undefined)
  })

  test('paginated query pages only the matching subset', async () => {
    const repo = newRepo()
    const all = await seed(repo, ['active', 'archived', 'active', 'archived', 'active'])
    // Recover which ids are active by reading them back.
    const activeIds = new Set((await repo.findByStatus('active')).map((t) => t.id))
    assert.equal(activeIds.size, 3)

    const seen = await walk((cursor) => repo.findByStatus('active', { limit: 2, cursor }), 2)

    assert.equal(seen.length, activeIds.size)
    assert.deepEqual(new Set(seen), activeIds)
    // Never leaks an archived entity.
    for (const id of seen) assert.ok(all.has(id))
  })

  test('same query without page options still returns a plain array', async () => {
    const repo = newRepo()
    await seed(repo, ['active', 'active', 'active'])
    const result = await repo.findByStatus('active')
    assert.ok(Array.isArray(result))
    assert.equal(result.length, 3)
  })
})
