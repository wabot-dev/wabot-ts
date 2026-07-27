import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

import { Auth } from '@/core/auth'
import { onGet, restController } from '@/feature/rest-controller'
import { createRestHarness, RestHarness } from '@/testing'

import { jwtGuard } from './@jwtGuard'

interface Session {
  userId: string
}

// Both audiences are signed with the same secret: only the `aud` claim keeps
// an admin token from working on a client endpoint and vice versa.
@restController('/aud')
class AudienceController {
  constructor(private auth: Auth<Session>) {}

  @onGet('/admin')
  @jwtGuard({ audience: 'admin' })
  admin() {
    return this.auth.require()
  }

  @onGet('/client')
  @jwtGuard({ audience: 'client' })
  client() {
    return this.auth.require()
  }

  @onGet('/any')
  @jwtGuard()
  any() {
    return this.auth.require()
  }

  @onGet('/admin-cookie')
  @jwtGuard({ cookie: 'wabot_admin', audience: 'admin' })
  adminCookie() {
    return this.auth.require()
  }
}

let harness: RestHarness

before(async () => {
  harness = await createRestHarness({ controllers: [AudienceController], jwt: true })
})

after(async () => {
  await harness.close()
})

test('a token signed for an audience passes the guard declaring it', async () => {
  const res = await harness
    .as({ userId: 'admin-1' }, { audience: 'admin' })
    .request('GET', '/aud/admin')
  assert.equal(res.status, 200)
  assert.equal(res.body.userId, 'admin-1')
  assert.equal(res.body.aud, 'admin')
})

test('a token of another audience is rejected even though the secret is valid', async () => {
  const res = await harness
    .as({ userId: 'client-1' }, { audience: 'client' })
    .request('GET', '/aud/admin')
  assert.equal(res.status, 401)
})

test('a token without audience is rejected by a guard that requires one', async () => {
  const res = await harness.as({ userId: 'u1' }).request('GET', '/aud/admin')
  assert.equal(res.status, 401)
})

test('a guard without audience accepts any valid token', async () => {
  const scoped = await harness
    .as({ userId: 'client-2' }, { audience: 'client' })
    .request('GET', '/aud/any')
  const plain = await harness.as({ userId: 'u2' }).request('GET', '/aud/any')
  assert.equal(scoped.status, 200)
  assert.equal(plain.status, 200)
})

test('cookie and audience combine: right cookie, wrong audience is rejected', async () => {
  const right = await harness
    .as({ userId: 'admin-2' }, { cookie: 'wabot_admin', audience: 'admin' })
    .request('GET', '/aud/admin-cookie')
  const wrong = await harness
    .as({ userId: 'client-3' }, { cookie: 'wabot_admin', audience: 'client' })
    .request('GET', '/aud/admin-cookie')

  assert.equal(right.status, 200)
  assert.equal(right.body.userId, 'admin-2')
  assert.equal(wrong.status, 401)
})
