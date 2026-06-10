import assert from 'node:assert/strict'
import test, { after } from 'node:test'

import { apiKeyGuard, ApiKeyRepository, jwtGuard } from '@/addon/auth'
import { Auth } from '@/core/auth'
import { isNotEmpty, isString } from '@/core/validation'
import { onGet, onPost, restController } from '@/feature/rest-controller'

import { TestApiKeyRepository } from './auth'
import { createRestHarness, RestHarness } from './restHarness'

class CreateItemRequest {
  @isString()
  @isNotEmpty()
  name: string = ''
}

@restController('/api/items')
class ItemsController {
  constructor(private auth: Auth<{ userId: string }>) {}

  @onGet('/public')
  async list() {
    return { items: ['a', 'b'] }
  }

  @onPost()
  async create(req: CreateItemRequest) {
    return { created: req.name }
  }

  @onGet('/secret')
  @jwtGuard()
  async secret() {
    return { userId: this.auth.require().userId }
  }

  @onGet('/api-secret')
  @apiKeyGuard()
  async apiSecret() {
    return { userId: this.auth.require().userId }
  }
}

const apiKeys = new TestApiKeyRepository<{ userId: string }>()
let harness: RestHarness

test.before(async () => {
  harness = await createRestHarness({
    controllers: [ItemsController],
    jwt: true,
    register: [[ApiKeyRepository, apiKeys]],
  })
})

after(async () => {
  await harness.close()
})

test('serves a public endpoint', async () => {
  const res = await harness.request('GET', '/api/items/public')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { items: ['a', 'b'] })
})

test('validates the request model and returns 400 with details', async () => {
  const ok = await harness.request('POST', '/api/items', { body: { name: 'thing' } })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body, { created: 'thing' })

  const bad = await harness.request('POST', '/api/items', { body: {} })
  assert.equal(bad.status, 400)
})

test('jwtGuard rejects requests without a token', async () => {
  const res = await harness.request('GET', '/api/items/secret')
  assert.equal(res.status, 401)
})

test('jwtGuard rejects a token signed with another secret', async () => {
  const res = await harness.request('GET', '/api/items/secret', {
    headers: { Authorization: `Bearer ${harness.jwt!.signInvalid({ userId: 'u1' })}` },
  })
  assert.equal(res.status, 401)
})

test('as(authInfo) passes the real jwtGuard and exposes Auth', async () => {
  const res = await harness.as({ userId: 'u1' }).request('GET', '/api/items/secret')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { userId: 'u1' })
})

test('apiKeyGuard works against the in-RAM TestApiKeyRepository', async () => {
  const secret = await apiKeys.addKey({ userId: 'u2' })

  const ok = await harness.request('GET', '/api/items/api-secret', {
    headers: { Authorization: `Api-Key ${secret}` },
  })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body, { userId: 'u2' })

  const bad = await harness.request('GET', '/api/items/api-secret', {
    headers: { Authorization: 'Api-Key sk_invalid' },
  })
  assert.equal(bad.status, 401)
})
