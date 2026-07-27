import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { repository } from './@repository'
import { dbPool } from './@dbPool'
import { DefaultDbPool } from './DefaultDbPool'
import { IDbPoolProvider } from './IDbPoolProvider'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'

interface IThingData extends IEntityData {
  name?: string
}
class Thing extends Entity<IThingData> {}

@dbPool()
class Db1Pool implements IDbPoolProvider {
  connection() {
    return 'postgres://db1'
  }
}

@dbPool()
class Db2Pool implements IDbPoolProvider {
  connection() {
    return 'postgres://db2'
  }
}

@dbPool()
class CustomDefaultDb implements IDbPoolProvider {
  connection() {
    return 'postgres://custom-default'
  }
}

@repository({ table: 'thing', constructor: Thing, pool: Db1Pool })
class ThingRepoDb1 {
  declare create: (t: Thing) => Promise<void>
  declare findAll: () => Promise<Thing[]>
}

@repository({ table: 'thing', constructor: Thing, pool: Db2Pool })
class ThingRepoDb2 {
  declare create: (t: Thing) => Promise<void>
  declare findAll: () => Promise<Thing[]>
}

@repository({ table: 'thing', constructor: Thing })
class ThingRepoDefault {
  declare create: (t: Thing) => Promise<void>
  declare findAll: () => Promise<Thing[]>
}

// Mirror how the runner wires databases: one adapter per provider class.
function wire(): RepositoryAdapterRegistry {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  const def = new MemoryRepositoryAdapter({ persist: false })
  registry.setDefault(def)
  registry.register(DefaultDbPool, def)
  registry.register(Db1Pool, new MemoryRepositoryAdapter({ persist: false }))
  registry.register(Db2Pool, new MemoryRepositoryAdapter({ persist: false }))
  return registry
}

test.describe('multi-database routing', () => {
  test('each repo reads/writes only its own database', async () => {
    wire()
    const r1 = new ThingRepoDb1()
    const r2 = new ThingRepoDb2()

    await r1.create(new Thing({ name: 'a' }))
    await r1.create(new Thing({ name: 'b' }))

    assert.equal((await r1.findAll()).length, 2)
    assert.equal((await r2.findAll()).length, 0, 'db2 must not see db1 writes')
  })

  test('a repo without pool uses the default database', async () => {
    wire()
    const rd = new ThingRepoDefault()
    const r1 = new ThingRepoDb1()

    await rd.create(new Thing({ name: 'x' }))

    assert.equal((await rd.findAll()).length, 1)
    assert.equal((await r1.findAll()).length, 0, 'db1 is separate from default')
  })

  test('a custom default provider resolves to the same adapter as the default', () => {
    // What the runner does when config.defaultDatabase = CustomDefaultDb: the
    // default adapter is registered under both the built-in default key and the
    // custom provider, so a no-pool repo and one with pool: CustomDefaultDb agree.
    const registry = container.resolve(RepositoryAdapterRegistry)
    registry.clear()
    const def = new MemoryRepositoryAdapter({ persist: false })
    registry.setDefault(def)
    registry.register(DefaultDbPool, def)
    registry.register(CustomDefaultDb, def)

    assert.equal(registry.getDefault(), def)
    assert.equal(registry.getForProvider(CustomDefaultDb), def)
    assert.equal(registry.getForProvider(DefaultDbPool), def)
  })

  test('referencing an unwired provider fails with a clear error', async () => {
    const registry = container.resolve(RepositoryAdapterRegistry)
    registry.clear()
    registry.setDefault(new MemoryRepositoryAdapter({ persist: false }))
    // Db1Pool intentionally not registered.
    const r1 = new ThingRepoDb1()
    await assert.rejects(
      () => r1.findAll(),
      /No repository adapter registered for database provider "Db1Pool"/,
    )
  })
})
