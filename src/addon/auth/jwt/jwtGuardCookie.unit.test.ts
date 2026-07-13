import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

import { Auth } from '@/core/auth'
import { Cookies, onGet, onPost, restController } from '@/feature/rest-controller'
import { createRestHarness, RestHarness } from '@/testing'

import { jwtGuard } from './@jwtGuard'
import { JwtConfig } from './JwtConfig'

interface Session {
  userId: string
}

@restController('/secure')
class SecureController {
  constructor(
    private auth: Auth<Session>,
    private cookies: Cookies,
    private config: JwtConfig,
  ) {}

  // Demonstrates writing the JWT to the auth cookie with the generic Cookies
  // helper (real apps pass the result of Jwt.createToken).
  @onPost('/login')
  login() {
    this.cookies.set(this.config.cookieName, 'issued-token', { httpOnly: true })
    return { ok: true }
  }

  @onGet('/me')
  @jwtGuard()
  me() {
    return this.auth.require()
  }
}

let harness: RestHarness

before(async () => {
  harness = await createRestHarness({ controllers: [SecureController], jwt: true })
})

after(async () => {
  await harness.close()
})

test('login writes the JWT to the configured auth cookie', async () => {
  const res = await harness.request('POST', '/secure/login')
  assert.match(res.headers.get('set-cookie') ?? '', /wabot_jwt=issued-token/)
})

test('@jwtGuard reads the token from the auth cookie', async () => {
  const token = harness.jwt!.sign({ userId: 'u7' })
  const res = await harness.request('GET', '/secure/me', {
    headers: { Cookie: `wabot_jwt=${token}` },
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.userId, 'u7')
})

test('@jwtGuard still accepts the Authorization header', async () => {
  const res = await harness.as({ userId: 'u8' }).request('GET', '/secure/me')
  assert.equal(res.status, 200)
  assert.equal(res.body.userId, 'u8')
})

test('@jwtGuard rejects when there is neither header nor cookie', async () => {
  const res = await harness.request('GET', '/secure/me')
  assert.equal(res.status, 401)
})
