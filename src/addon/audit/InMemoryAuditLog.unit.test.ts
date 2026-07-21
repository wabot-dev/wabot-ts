import test from 'node:test'
import assert from 'node:assert/strict'

import { runWithLogContext } from '@/core/logger'
import { setAuditActor, setAuditSource } from '@/core/audit'
import { InMemoryAuditLog } from './InMemoryAuditLog'

test.describe('AuditLog (in-memory) + context capture', () => {
  test('record stamps actor, source, and requestId from the current context', async () => {
    const audit = new InMemoryAuditLog()
    await runWithLogContext({ requestId: 'req-1' }, async () => {
      setAuditActor({ type: 'user', id: 'u1' })
      setAuditSource('command:orders.charge')
      await audit.record({ stream: 'order', action: 'destroyed', target: 'o1', data: { total: 5 } })
    })

    const [e] = await audit.query({ stream: 'order' })
    assert.equal(e.actor.type, 'user')
    assert.equal(e.actor.id, 'u1')
    assert.equal(e.requestId, 'req-1')
    assert.equal(e.source, 'command:orders.charge')
    assert.equal(e.target, 'o1')
    assert.deepEqual(e.data, { total: 5 })
  })

  test('defaults the actor to system with no context', async () => {
    const audit = new InMemoryAuditLog()
    await audit.record({ stream: 's', action: 'x' })
    const [e] = await audit.query({ stream: 's' })
    assert.equal(e.actor.type, 'system')
    assert.equal(e.requestId, undefined)
  })

  test('an explicit actor/source overrides the ambient context', async () => {
    const audit = new InMemoryAuditLog()
    await runWithLogContext({}, async () => {
      setAuditActor({ type: 'user', id: 'u1' })
      await audit.record({ stream: 's', action: 'x', actor: { type: 'system' }, source: 'manual' })
    })
    const [e] = await audit.query({ stream: 's' })
    assert.equal(e.actor.type, 'system')
    assert.equal(e.source, 'manual')
  })

  test('query filters by target / action and isolates streams', async () => {
    const audit = new InMemoryAuditLog()
    await audit.record({ stream: 'order', action: 'created', target: 'a' })
    await audit.record({ stream: 'order', action: 'destroyed', target: 'a' })
    await audit.record({ stream: 'order', action: 'destroyed', target: 'b' })

    assert.equal((await audit.query({ stream: 'order' })).length, 3)
    assert.equal((await audit.query({ stream: 'order', target: 'a' })).length, 2)
    assert.equal((await audit.query({ stream: 'order', action: 'destroyed' })).length, 2)
    assert.equal((await audit.query({ stream: 'order', action: 'destroyed', limit: 1 })).length, 1)
    assert.equal((await audit.query({ stream: 'other' })).length, 0)
  })
})
