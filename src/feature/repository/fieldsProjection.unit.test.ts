import test from 'node:test'
import assert from 'node:assert/strict'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { PgColumnsRepository } from '@/feature/pg'
import { repository } from './@repository'
import { IRepositoryConfig } from './IRepositoryConfig'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'

interface IUserData extends IEntityData {
  email?: string
  name?: string
  /** A column the projected repository is not allowed to see. */
  secret?: string
}
class User extends Entity<IUserData> {}

const projectedConfig: IRepositoryConfig<User> = {
  table: 'projected_user',
  constructor: User,
  fields: ['email', 'name'],
}

/** Adapter + runtime over `projectedConfig`, plus direct access to the store. */
function projectedRuntime() {
  const adapter = new MemoryRepositoryAdapter({ persist: false })
  const runtime = adapter.build(projectedConfig)
  const store = (adapter as any).getStore(projectedConfig)
  // A row that carries more than the repository projects — what any repository
  // over a wide or legacy table finds waiting for it.
  store.touch(
    new User({
      id: 'u1',
      createdAt: Date.now(),
      email: 'a@b.c',
      name: 'Ana',
      secret: 'token',
    } as IUserData),
  )
  return { runtime, store }
}

test.describe('the fields projection on the memory backend', () => {
  test('a field outside the projection is not read', async () => {
    const { runtime } = projectedRuntime()

    const view = (await runtime.find('u1'))!

    assert.equal(view['data'].email, 'a@b.c')
    assert.equal(view['data'].secret, undefined)
  })

  test('an update through the projection leaves the rest of the row alone', async () => {
    const { runtime, store } = projectedRuntime()

    const view = (await runtime.find('u1'))!
    view['data'].name = 'Ana María'
    await runtime.update(view)

    const stored = store.items.get('u1')!
    assert.equal(stored['data'].name, 'Ana María', 'the projected field was written')
    assert.equal(stored['data'].secret, 'token', 'the untouched column kept its value')
  })

  test('a field outside the projection is not written on create', async () => {
    const { runtime, store } = projectedRuntime()

    const created = new User({ email: 'x@y.z', name: 'Bea', secret: 'leaked' })
    await runtime.create(created)

    assert.equal(store.items.get(created.id)!['data'].secret, undefined)
  })
})

@repository({ table: 'whole_user', constructor: User })
class WholeUserRepository extends PgColumnsRepository<User> {
  declare find: (id: string) => Promise<User | null>
  declare create: (item: User) => Promise<void>
}

test('a repository without a projection keeps every field', async () => {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new MemoryRepositoryAdapter({ persist: false }))
  const repo = new WholeUserRepository()

  const user = new User({ email: 'a@b.c', name: 'Ana', secret: 'token' })
  await repo.create(user)

  assert.equal((await repo.find(user.id))?.['data'].secret, 'token')
})
