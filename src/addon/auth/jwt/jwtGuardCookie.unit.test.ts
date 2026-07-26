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

const ADMIN_COOKIE = 'wabot_admin'
const CLIENT_COOKIE = 'wabot_client'

// Two kinds of user logged in on the same browser: each session lives in its
// own cookie, so neither overwrites the other.
@restController('/multi')
class MultiSessionController {
  constructor(
    private auth: Auth<Session>,
    private cookies: Cookies,
  ) {}

  @onPost('/admin/login')
  adminLogin() {
    this.cookies.set(ADMIN_COOKIE, 'admin-token', { httpOnly: true })
    return { ok: true }
  }

  @onGet('/admin/me')
  @jwtGuard({ cookie: ADMIN_COOKIE })
  adminMe() {
    return this.auth.require()
  }

  @onGet('/client/me')
  @jwtGuard({ cookie: CLIENT_COOKIE })
  clientMe() {
    return this.auth.require()
  }

  @onGet('/any/me')
  @jwtGuard({ cookie: [ADMIN_COOKIE, CLIENT_COOKIE] })
  anyMe() {
    return this.auth.require()
  }
}

let harness: RestHarness

before(async () => {
  harness = await createRestHarness({
    controllers: [SecureController, MultiSessionController],
    jwt: true,
  })
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

test('each session cookie resolves its own user when both are in the browser', async () => {
  const admin = harness.jwt!.sign({ userId: 'admin-1' })
  const client = harness.jwt!.sign({ userId: 'client-1' })
  const headers = { Cookie: `${ADMIN_COOKIE}=${admin}; ${CLIENT_COOKIE}=${client}` }

  const adminRes = await harness.request('GET', '/multi/admin/me', { headers })
  const clientRes = await harness.request('GET', '/multi/client/me', { headers })

  assert.equal(adminRes.body.userId, 'admin-1')
  assert.equal(clientRes.body.userId, 'client-1')
})

test('a guard scoped to one cookie ignores the other session', async () => {
  const client = harness.jwt!.sign({ userId: 'client-2' })
  const res = await harness.request('GET', '/multi/admin/me', {
    headers: { Cookie: `${CLIENT_COOKIE}=${client}` },
  })
  assert.equal(res.status, 401)
})

test('a guard with several cookies takes the first one present', async () => {
  const client = harness.jwt!.sign({ userId: 'client-3' })
  const both = harness.jwt!.sign({ userId: 'admin-3' })

  const onlyClient = await harness.request('GET', '/multi/any/me', {
    headers: { Cookie: `${CLIENT_COOKIE}=${client}` },
  })
  const withAdmin = await harness.request('GET', '/multi/any/me', {
    headers: { Cookie: `${CLIENT_COOKIE}=${client}; ${ADMIN_COOKIE}=${both}` },
  })

  assert.equal(onlyClient.body.userId, 'client-3')
  assert.equal(withAdmin.body.userId, 'admin-3')
})

test('the default cookie no longer opens a scoped guard', async () => {
  const token = harness.jwt!.sign({ userId: 'u9' })
  const res = await harness.request('GET', '/multi/admin/me', {
    headers: { Cookie: `wabot_jwt=${token}` },
  })
  assert.equal(res.status, 401)
})

test('as(authInfo, { cookie }) signs the session cookie in tests', async () => {
  const res = await harness
    .as({ userId: 'admin-4' }, { cookie: ADMIN_COOKIE })
    .request('GET', '/multi/admin/me')
  assert.equal(res.status, 200)
  assert.equal(res.body.userId, 'admin-4')
})

test('a login writes only its own session cookie', async () => {
  const res = await harness.request('POST', '/multi/admin/login')
  const setCookie = res.headers.get('set-cookie') ?? ''
  assert.match(setCookie, /wabot_admin=admin-token/)
  assert.doesNotMatch(setCookie, /wabot_jwt=/)
})
