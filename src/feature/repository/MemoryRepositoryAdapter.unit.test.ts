import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { repository } from './@repository'
import { query } from './@query'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'

interface IThingData extends IEntityData {
  status?: string
  email?: string | null
  name?: string
  age?: number
}

class Thing extends Entity<IThingData> {}

@repository({ table: 'thing', constructor: Thing })
class ThingRepository {
  declare find: (id: string) => Promise<Thing | null>
  declare findOrThrow: (id: string) => Promise<Thing>
  declare findByIds: (ids: string[]) => Promise<Thing[]>
  declare findAll: () => Promise<Thing[]>
  declare create: (item: Thing) => Promise<void>
  declare update: (item: Thing) => Promise<void>
  declare delete: (item: Thing) => Promise<void>

  @query() declare findByStatus: (status: string) => Promise<Thing[]>
  @query() declare findOneByEmail: (email: string) => Promise<Thing | null>
  @query() declare countByStatusAndAge: (status: string, age: number) => Promise<number>
  @query() declare existsByName: (name: string) => Promise<boolean>
  @query() declare deleteByStatus: (status: string) => Promise<void>
  @query() declare findByEmailIsNull: () => Promise<Thing[]>
  @query() declare findByAgeGreaterThan: (age: number) => Promise<Thing[]>
  @query() declare findByStatusOrEmail: (status: string, email: string) => Promise<Thing[]>
  @query() declare findAllOrderByAgeAsc: () => Promise<Thing[]>
  @query() declare findAllOrderByAgeDescLimit2: () => Promise<Thing[]>
}

function newRepo(): ThingRepository {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new MemoryRepositoryAdapter())
  return new ThingRepository()
}

async function makeThing(repo: ThingRepository, data: IThingData) {
  const t = new Thing(data)
  await repo.create(t)
  return t
}

test.describe('MemoryRepositoryAdapter + @repository', () => {
  test('create/find/findOrThrow/findAll/findByIds round trip', async () => {
    const repo = newRepo()
    const a = await makeThing(repo, { status: 'active', name: 'alpha', age: 30 })
    const b = await makeThing(repo, { status: 'archived', name: 'beta', age: 40 })

    assert.equal((await repo.find(a.id))?.['data'].name, 'alpha')
    assert.equal((await repo.findOrThrow(b.id))['data'].status, 'archived')
    const all = await repo.findAll()
    assert.equal(all.length, 2)
    const both = await repo.findByIds([a.id, b.id])
    assert.equal(both.length, 2)
  })

  test('findOrThrow throws when missing', async () => {
    const repo = newRepo()
    await assert.rejects(() => repo.findOrThrow('nope'), /Not found/)
  })

  test('update modifies stored entity', async () => {
    const repo = newRepo()
    const a = await makeThing(repo, { status: 'active', name: 'alpha', age: 30 })
    a.update({ status: 'archived' })
    await repo.update(a)
    const fresh = await repo.findOrThrow(a.id)
    assert.equal(fresh['data'].status, 'archived')
  })

  test('delete removes entity', async () => {
    const repo = newRepo()
    const a = await makeThing(repo, { status: 'active', name: 'alpha', age: 30 })
    await repo.delete(a)
    assert.equal(await repo.find(a.id), null)
  })

  test('findBy{Field} filters by equality', async () => {
    const repo = newRepo()
    await makeThing(repo, { status: 'active', name: 'a', age: 10 })
    await makeThing(repo, { status: 'active', name: 'b', age: 20 })
    await makeThing(repo, { status: 'archived', name: 'c', age: 30 })

    const active = await repo.findByStatus('active')
    assert.equal(active.length, 2)
    for (const t of active) assert.equal(t['data'].status, 'active')
  })

  test('findOneBy{Field} returns first or null', async () => {
    const repo = newRepo()
    await makeThing(repo, { email: 'a@b.com', name: 'a' })
    assert.equal((await repo.findOneByEmail('a@b.com'))?.['data'].email, 'a@b.com')
    assert.equal(await repo.findOneByEmail('missing@b.com'), null)
  })

  test('countBy combines two predicates with AND', async () => {
    const repo = newRepo()
    await makeThing(repo, { status: 'active', age: 30 })
    await makeThing(repo, { status: 'active', age: 40 })
    await makeThing(repo, { status: 'active', age: 30 })
    await makeThing(repo, { status: 'archived', age: 30 })

    assert.equal(await repo.countByStatusAndAge('active', 30), 2)
  })

  test('existsBy returns boolean', async () => {
    const repo = newRepo()
    await makeThing(repo, { name: 'foo' })
    assert.equal(await repo.existsByName('foo'), true)
    assert.equal(await repo.existsByName('bar'), false)
  })

  test('deleteBy removes matching entities', async () => {
    const repo = newRepo()
    await makeThing(repo, { status: 'archived', name: 'a' })
    await makeThing(repo, { status: 'archived', name: 'b' })
    await makeThing(repo, { status: 'active', name: 'c' })
    await repo.deleteByStatus('archived')
    const remaining = await repo.findAll()
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0]['data'].status, 'active')
  })

  test('IsNull condition takes zero arguments and matches missing values', async () => {
    const repo = newRepo()
    await makeThing(repo, { email: null, name: 'a' })
    await makeThing(repo, { name: 'b' })
    await makeThing(repo, { email: 'x@y.z', name: 'c' })

    const nullish = await repo.findByEmailIsNull()
    assert.equal(nullish.length, 2)
  })

  test('GreaterThan filters numerically', async () => {
    const repo = newRepo()
    await makeThing(repo, { age: 10 })
    await makeThing(repo, { age: 20 })
    await makeThing(repo, { age: 30 })

    const older = await repo.findByAgeGreaterThan(15)
    assert.equal(older.length, 2)
  })

  test('Or precedence: A and B or C → (A and B) or C', async () => {
    const repo = newRepo()
    await makeThing(repo, { status: 'x', email: 'a@b.com' })
    await makeThing(repo, { status: 'other', email: 'a@b.com' })
    await makeThing(repo, { status: 'x', email: 'other@b.com' })

    const result = await repo.findByStatusOrEmail('other', 'a@b.com')
    assert.equal(result.length, 2)
  })

  test('OrderBy + Limit', async () => {
    const repo = newRepo()
    await makeThing(repo, { age: 30 })
    await makeThing(repo, { age: 10 })
    await makeThing(repo, { age: 20 })

    const asc = await repo.findAllOrderByAgeAsc()
    assert.deepEqual(
      asc.map((t) => t['data'].age),
      [10, 20, 30],
    )

    const desc = await repo.findAllOrderByAgeDescLimit2()
    assert.deepEqual(
      desc.map((t) => t['data'].age),
      [30, 20],
    )
  })

  test('argument-count mismatch surfaces a clear error', async () => {
    const repo = newRepo()
    await assert.rejects(
      () => (repo as any).countByStatusAndAge('only-one'),
      /expected 2 argument\(s\), received 1/,
    )
  })

  test('throws when no adapter is registered', async () => {
    const registry = container.resolve(RepositoryAdapterRegistry)
    registry.clear()
    const repo = new ThingRepository()
    await assert.rejects(() => repo.findAll(), /No repository adapter registered/)
  })
})
