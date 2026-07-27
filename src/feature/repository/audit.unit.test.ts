import test from 'node:test'
import assert from 'node:assert/strict'

import { AuditLog } from '@/core/audit'
import { Entity, IEntityData } from '@/core/entity'
import { CrudRepository } from '@/core/repository'
import { container } from '@/core/injection'
import { InMemoryAuditLog } from '@/addon/audit/InMemoryAuditLog'
import { repository } from './@repository'
import { MemoryRepositoryAdapter } from './MemoryRepositoryAdapter'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'

interface IOrderData extends IEntityData {
  total?: number
}
class Order extends Entity<IOrderData> {}

@repository({ table: 'order_full', constructor: Order, audit: true })
class AuditedOrderRepo extends CrudRepository<Order> {}

@repository({ table: 'order_destroy', constructor: Order, audit: { events: ['destroy'] } })
class DestroyOnlyRepo extends CrudRepository<Order> {}

@repository({ table: 'order_plain', constructor: Order })
class PlainRepo extends CrudRepository<Order> {}

function wire(): InMemoryAuditLog {
  const registry = container.resolve(RepositoryAdapterRegistry)
  registry.clear()
  registry.setDefault(new MemoryRepositoryAdapter({ persist: false }))
  const audit = new InMemoryAuditLog()
  container.registerInstance(AuditLog, audit)
  return audit
}

test.describe('@repository audit integration', () => {
  test('records create/update/destroy and recovers a destroyed entity with the same id', async () => {
    const audit = wire()
    const repo = new AuditedOrderRepo()

    const order = new Order({ total: 10 })
    await repo.create(order)
    const id = order.id
    order.update({ total: 20 })
    await repo.update(order)
    await repo.delete(order)

    const entries = await audit.query({ stream: 'order_full', target: id })
    assert.deepEqual(entries.map((e) => e.action).sort(), ['created', 'destroyed', 'updated'])
    const destroyed = entries.find((e) => e.action === 'destroyed')!
    assert.equal(destroyed.data?.total, 20, 'destroy snapshot holds the final state')

    // hard-deleted, so it is gone from the data store…
    assert.equal(await repo.find(id), null)

    // …but recoverable from its audit snapshot, same id.
    const back = await repo.recover(id)
    assert.equal(back.id, id)
    const found = await repo.find(id)
    assert.equal(found?.['data'].total, 20)
  })

  test('records only the selected events', async () => {
    const audit = wire()
    const repo = new DestroyOnlyRepo()

    const order = new Order({ total: 1 })
    await repo.create(order)
    await repo.delete(order)

    assert.deepEqual(
      (await audit.query({ stream: 'order_destroy' })).map((e) => e.action),
      ['destroyed'],
    )
  })

  test('a non-audited repo records nothing and recover throws', async () => {
    const audit = wire()
    const repo = new PlainRepo()

    const order = new Order({ total: 1 })
    await repo.create(order)
    const id = order.id
    await repo.delete(order)

    assert.equal((await audit.query({ stream: 'order_plain' })).length, 0)
    await assert.rejects(() => repo.recover(id), /audit is not enabled/)
  })
})
