import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { repository } from './@repository'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'
import { resolveIdStrategy } from './idStrategy'

interface IThingData extends IEntityData {
  name?: string
}

class Thing extends Entity<IThingData> {}

function useMemory(): void {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new MemoryRepositoryAdapter({ persist: false }))
}

test.describe('resolveIdStrategy', () => {
  const label = 'things'

  /** Narrow to the only kind that carries a generator, so the test can call it. */
  function generatorFor(strategy: Parameters<typeof resolveIdStrategy<Thing>>[0]) {
    const resolved = resolveIdStrategy<Thing>(strategy, { label })
    assert.equal(resolved.kind, 'generated')
    return resolved as Extract<typeof resolved, { kind: 'generated' }>
  }

  test('defaults to a generated short uuid', async () => {
    const id = await generatorFor(undefined).next(new Thing({}))
    assert.equal(typeof id, 'string')
    assert.ok(id.length > 0)
  })

  test("'uuid' generates an RFC 4122 v4", async () => {
    const id = await generatorFor('uuid').next(new Thing({}))
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  test('a function receives the entity and may be async', async () => {
    const strategy = generatorFor(async (item) => `thing-${item['data'].name}`)
    assert.equal(await strategy.next(new Thing({ name: 'alpha' })), 'thing-alpha')
  })

  test('a generator returning something other than a non-empty string is refused', async () => {
    const strategy = generatorFor(() => '' as string)
    await assert.rejects(() => strategy.next(new Thing({})), /must return a non-empty string/)
  })

  test("'database' leaves the id to the backend", () => {
    assert.deepEqual(resolveIdStrategy<Thing>('database', { label }), { kind: 'database' })
  })

  test('{ sequence } carries the name, trimmed', () => {
    assert.deepEqual(resolveIdStrategy<Thing>({ sequence: ' game_id_seq ' }, { label }), {
      kind: 'sequence',
      sequence: 'game_id_seq',
    })
  })

  test('{ sequence } without a name is refused', () => {
    assert.throws(
      () => resolveIdStrategy<Thing>({ sequence: '  ' }, { label }),
      /needs the name of a database sequence/,
    )
  })

  test('a sequence is available even where the table cannot assign the id', () => {
    assert.equal(
      resolveIdStrategy<Thing>(
        { sequence: 'game_id_seq' },
        { label, supportsDatabaseAssigned: false },
      ).kind,
      'sequence',
    )
  })

  test("'database' is refused where the framework owns the table", () => {
    assert.throws(
      () => resolveIdStrategy<Thing>('database', { label, supportsDatabaseAssigned: false }),
      /Extend PgColumnsRepository and own the table in a migration/,
    )
  })

  test('the refusal points at the sequence alternative', () => {
    assert.throws(
      () => resolveIdStrategy<Thing>('database', { label, supportsDatabaseAssigned: false }),
      /id: \{ sequence: '\.\.\.' \}/,
    )
  })

  test('an unknown strategy names the options', () => {
    assert.throws(
      () => resolveIdStrategy<Thing>('ulid' as any, { label }),
      /unknown id strategy "ulid"/,
    )
  })
})

test.describe('@repository({ id }) on the memory backend', () => {
  test('without the option, ids stay opaque and unique', async () => {
    @repository({ table: 'default_id_thing', constructor: Thing })
    class ThingRepository {
      declare create: (item: Thing) => Promise<void>
    }
    useMemory()
    const repo = new ThingRepository()

    const a = new Thing({ name: 'a' })
    const b = new Thing({ name: 'b' })
    await repo.create(a)
    await repo.create(b)

    assert.notEqual(a.id, b.id)
    assert.doesNotMatch(a.id, /^\d+$/)
  })

  test('a function decides the id', async () => {
    @repository({
      table: 'custom_id_thing',
      constructor: Thing,
      id: (item: Thing) => `thing_${item['data'].name}`,
    })
    class ThingRepository {
      declare create: (item: Thing) => Promise<void>
      declare find: (id: string) => Promise<Thing | null>
    }
    useMemory()
    const repo = new ThingRepository()

    const thing = new Thing({ name: 'alpha' })
    await repo.create(thing)

    assert.equal(thing.id, 'thing_alpha')
    assert.equal((await repo.find('thing_alpha'))?.['data'].name, 'alpha')
  })

  test("'database' hands out sequential ids, like the sequence it stands in for", async () => {
    @repository({ table: 'db_id_thing', constructor: Thing, id: 'database' })
    class ThingRepository {
      declare create: (item: Thing) => Promise<void>
      declare delete: (item: Thing) => Promise<void>
      declare find: (id: string) => Promise<Thing | null>
    }
    useMemory()
    const repo = new ThingRepository()

    const first = new Thing({ name: 'first' })
    const second = new Thing({ name: 'second' })
    await repo.create(first)
    await repo.create(second)

    assert.equal(first.id, '1')
    assert.equal(second.id, '2')

    // A deleted row does not hand its id back to the next insert.
    await repo.delete(second)
    const third = new Thing({ name: 'third' })
    await repo.create(third)
    assert.equal(third.id, '3')
    assert.equal((await repo.find('3'))?.['data'].name, 'third')
  })

  test('a named sequence is never drawn twice, even by two repositories', async () => {
    @repository({ table: 'seq_thing_a', constructor: Thing, id: { sequence: 'shared_seq' } })
    class ThingARepository {
      declare create: (item: Thing) => Promise<void>
    }
    @repository({ table: 'seq_thing_b', constructor: Thing, id: { sequence: 'shared_seq' } })
    class ThingBRepository {
      declare create: (item: Thing) => Promise<void>
    }
    useMemory()
    const a = new ThingARepository()
    const b = new ThingBRepository()

    const first = new Thing({ name: 'a1' })
    const second = new Thing({ name: 'b1' })
    const third = new Thing({ name: 'a2' })
    await a.create(first)
    await b.create(second)
    await a.create(third)

    // Two tables, one sequence: the numbers interleave instead of colliding.
    assert.deepEqual([first.id, second.id, third.id], ['1', '2', '3'])
  })

  test('separate sequences count separately', async () => {
    @repository({ table: 'own_seq_thing', constructor: Thing, id: { sequence: 'own_seq' } })
    class ThingRepository {
      declare create: (item: Thing) => Promise<void>
    }
    useMemory()
    const repo = new ThingRepository()

    const thing = new Thing({ name: 'only' })
    await repo.create(thing)
    assert.equal(thing.id, '1')
  })
})
