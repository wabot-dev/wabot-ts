import assert from 'node:assert/strict'
import test from 'node:test'

import { Auth } from '@/core/auth'
import { container } from '@/core/injection'
import { setupTestJwt } from '@/testing'

import {
  IJwtHandshakeGuardOptions,
  JwtHandshakeGuardMiddleware,
} from './JwtHandshakeGuardMiddleware'

const ORIGIN = 'https://app.wabot.dev'
const testJwt = setupTestJwt({ cookieAllowedOrigins: [ORIGIN] })

interface IFakeHandshake {
  token?: string
  authorization?: string
  cookie?: string
  origin?: string
}

/** Minimal stand-in for the Socket.IO handshake the guard reads. */
function fakeSocket(handshake: IFakeHandshake) {
  return {
    handshake: {
      auth: handshake.token ? { token: handshake.token } : {},
      headers: {
        ...(handshake.authorization ? { authorization: handshake.authorization } : {}),
        ...(handshake.cookie ? { cookie: handshake.cookie } : {}),
        ...(handshake.origin ? { origin: handshake.origin } : {}),
      },
    },
  } as any
}

async function guard(handshake: IFakeHandshake, options: IJwtHandshakeGuardOptions) {
  const auth = new Auth<any>()
  const middleware = new JwtHandshakeGuardMiddleware(testJwt.config, auth)
  await middleware.authenticate(fakeSocket(handshake), container, options)
  return auth
}

test('the handshake authenticates from an httpOnly cookie on an allowed origin', async () => {
  const token = testJwt.sign({ userId: 'admin-1' }, { audience: 'admin' })

  const auth = await guard(
    { cookie: `wabot_admin=${token}`, origin: ORIGIN },
    { cookie: 'wabot_admin', audience: 'admin' },
  )

  assert.equal(auth.require().userId, 'admin-1')
})

test('a cookie handshake from another origin is rejected', async () => {
  const token = testJwt.sign({ userId: 'admin-2' })

  await assert.rejects(
    () =>
      guard(
        { cookie: `wabot_admin=${token}`, origin: 'https://evil.example' },
        { cookie: 'wabot_admin' },
      ),
    /Origin not allowed/,
  )
})

test('a cookie handshake without Origin header is rejected', async () => {
  const token = testJwt.sign({ userId: 'admin-3' })

  await assert.rejects(
    () => guard({ cookie: `wabot_admin=${token}` }, { cookie: 'wabot_admin' }),
    /Origin not allowed/,
  )
})

test('cookies are refused when no origin allowlist is configured', async () => {
  const openJwt = setupTestJwt()
  const auth = new Auth<any>()
  const middleware = new JwtHandshakeGuardMiddleware(openJwt.config, auth)
  const socket = fakeSocket({
    cookie: `wabot_admin=${openJwt.sign({ userId: 'u1' })}`,
    origin: ORIGIN,
  })

  await assert.rejects(
    () => middleware.authenticate(socket, container, { cookie: 'wabot_admin' }),
    /requires an origin allowlist/,
  )
})

test('a wildcard allowlist is refused instead of silently allowing everything', async () => {
  const token = testJwt.sign({ userId: 'u2' })

  await assert.rejects(
    () =>
      guard(
        { cookie: `wabot_admin=${token}`, origin: ORIGIN },
        { cookie: 'wabot_admin', allowedOrigins: ['*'] },
      ),
    /cannot allow every origin/,
  )
})

test('handshake.auth tokens keep working and are never origin-checked', async () => {
  const token = testJwt.sign({ userId: 'u3' })

  const auth = await guard({ token, origin: 'https://evil.example' }, { cookie: 'wabot_admin' })

  assert.equal(auth.require().userId, 'u3')
})

test('the Authorization header still wins over the cookie', async () => {
  const header = testJwt.sign({ userId: 'header-1' })
  const cookieToken = testJwt.sign({ userId: 'cookie-1' })

  const auth = await guard(
    {
      authorization: `Bearer ${header}`,
      cookie: `wabot_admin=${cookieToken}`,
      origin: ORIGIN,
    },
    { cookie: 'wabot_admin' },
  )

  assert.equal(auth.require().userId, 'header-1')
})

test('each socket namespace reads its own session cookie', async () => {
  const admin = testJwt.sign({ userId: 'admin-4' }, { audience: 'admin' })
  const client = testJwt.sign({ userId: 'client-4' }, { audience: 'client' })
  const cookie = `wabot_admin=${admin}; wabot_client=${client}`

  const asAdmin = await guard(
    { cookie, origin: ORIGIN },
    { cookie: 'wabot_admin', audience: 'admin' },
  )
  const asClient = await guard(
    { cookie, origin: ORIGIN },
    { cookie: 'wabot_client', audience: 'client' },
  )

  assert.equal(asAdmin.require().userId, 'admin-4')
  assert.equal(asClient.require().userId, 'client-4')

  await assert.rejects(
    () => guard({ cookie, origin: ORIGIN }, { cookie: 'wabot_client', audience: 'admin' }),
    /Invalid token/,
  )
})

test('an allowed origin with different case or trailing slash still matches', async () => {
  const token = testJwt.sign({ userId: 'u4' })

  const auth = await guard(
    { cookie: `wabot_admin=${token}`, origin: 'HTTPS://App.Wabot.dev/' },
    { cookie: 'wabot_admin' },
  )

  assert.equal(auth.require().userId, 'u4')
})
