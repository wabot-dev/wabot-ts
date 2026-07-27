import test from 'node:test'
import assert from 'node:assert/strict'

import { AuditActorResolver } from './AuditActorResolver'

interface MyAuth {
  userId: string
  email: string
}

class MyAuditActor extends AuditActorResolver {
  fromAuth(info: MyAuth) {
    return { type: 'user' as const, id: info.userId, label: info.email }
  }
}

test.describe('AuditActorResolver', () => {
  test('default: an authenticated action is a bare user (no fabricated id)', () => {
    assert.deepEqual(new AuditActorResolver().fromAuth({ anything: true }), { type: 'user' })
  })

  test('override: the app maps its own auth shape to an attributed actor', () => {
    const actor = new MyAuditActor().fromAuth({ userId: 'u1', email: 'a@b.com' })
    assert.deepEqual(actor, { type: 'user', id: 'u1', label: 'a@b.com' })
  })
})
