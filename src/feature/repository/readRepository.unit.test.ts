import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { CrudRepository, ReadRepository } from '@/core/repository'
import { container } from '@/core/injection'
import { repository } from './@repository'
import { query } from './@query'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'

interface IThingData extends IEntityData {
  name?: string
}
class Thing extends Entity<IThingData> {}

// Same config object → both repos share one memory store (write model + read model).
const sharedConfig = { table: 'thing', constructor: Thing }

@repository(sharedConfig)
class ThingWriter extends CrudRepository<Thing> {}

@repository(sharedConfig)
class ThingReader extends ReadRepository<Thing> {
  @query() declare findByName: (name: string) => Promise<Thing[]>
}

// Not decorated at module load, so we can assert @repository throws on it.
class BadReadRepo extends ReadRepository<Thing> {
  @query() declare deleteByName: (name: string) => Promise<void>
}

function wire(): void {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new MemoryRepositoryAdapter({ persist: false }))
}

test.describe('ReadRepository (read-only / CQRS read model)', () => {
  test('reads work but write methods are not installed', async () => {
    wire()
    const writer = new ThingWriter()
    const reader = new ThingReader()

    await writer.create(new Thing({ name: 'a' }))
    await writer.create(new Thing({ name: 'b' }))

    assert.equal((await reader.findAll()).length, 2)
    assert.equal((await reader.findByName('a')).length, 1)

    // Read methods present, write methods absent (type has none either).
    assert.equal(typeof (reader as any).find, 'function')
    assert.equal(typeof (reader as any).findPage, 'function')
    assert.equal(typeof (reader as any).create, 'undefined')
    assert.equal(typeof (reader as any).update, 'undefined')
    assert.equal(typeof (reader as any).delete, 'undefined')
  })

  test('a full CrudRepository still gets write methods', () => {
    const writer = new ThingWriter()
    assert.equal(typeof (writer as any).create, 'function')
    assert.equal(typeof (writer as any).delete, 'function')
  })

  test('declaring a mutation query on a read-only repo fails at decoration', () => {
    assert.throws(
      () => repository({ table: 'bad', constructor: Thing })(BadReadRepo as any),
      /cannot declare a mutation query/,
    )
  })
})
