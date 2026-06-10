import { randomUUID } from 'node:crypto'

import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { MemoryRepositoryAdapter, RepositoryAdapterRegistry } from '@/feature/repository'

/**
 * Back every @repository with an in-RAM adapter (no PostgreSQL, no `.wabot/`
 * persistence). Call it once at the top of a test file, before resolving any
 * repository (each @repository caches its runtime on first use). Test files
 * run in separate processes, so each file gets its own empty store.
 */
export function useMemoryRepositories(): MemoryRepositoryAdapter {
  const adapter = new MemoryRepositoryAdapter({ persist: false })
  container.resolve(RepositoryAdapterRegistry).setDefault(adapter)
  return adapter
}

export interface IEntityFixtureOptions {
  id?: string
  createdAt?: Date | number
}

/**
 * Build an entity in "already created" state (id and createdAt set), so
 * tests can seed data without going through a repository create().
 */
export function entityFixture<D extends IEntityData, E extends Entity<D>>(
  entityConstructor: IConstructor<E>,
  data: Omit<D, keyof IEntityData>,
  options: IEntityFixtureOptions = {},
): E {
  const createdAt = options.createdAt ?? Date.now()
  const fullData = {
    ...data,
    id: options.id ?? randomUUID(),
    createdAt: createdAt instanceof Date ? createdAt.getTime() : createdAt,
  } as unknown as D
  const entity = new entityConstructor(fullData)
  entity.validate()
  return entity
}
