import assert from 'node:assert/strict'
import test from 'node:test'
import jwtLib from 'jsonwebtoken'

import { Auth } from '@/core/auth'
import { container } from '@/core/injection'
import { entityFixture, setupTestJwt, useMemoryRepositories } from '@/testing'

import { Jwt } from './Jwt'
import { JwtConfig } from './JwtConfig'
import { JwtRefreshToken } from './JwtRefreshToken'
import { JwtSigner } from './JwtSigner'

useMemoryRepositories()

const testJwt = setupTestJwt()

/** A container with the test JwtConfig and an already authenticated session. */
function sessionContainer(authInfo: object) {
  const child = container.createChildContainer()
  child.registerInstance(JwtConfig, testJwt.config)
  ;(child.resolve(Auth) as Auth<any>).override(authInfo)
  return child
}

function decode(token?: string) {
  return jwtLib.decode(token!) as Record<string, any>
}

test('createToken stamps the audience on the access token', async () => {
  const jwt = sessionContainer({ userId: 'admin-1' }).resolve(Jwt)

  const { access } = await jwt.createToken(undefined, { audience: 'admin' })

  assert.equal(decode(access?.token).aud, 'admin')
  assert.equal(decode(access?.token).userId, 'admin-1')
})

test('createToken without audience leaves the token unscoped', async () => {
  const jwt = sessionContainer({ userId: 'u1' }).resolve(Jwt)

  const { access } = await jwt.createToken()

  assert.equal(decode(access?.token).aud, undefined)
})

test('a refresh token only renews the audience it was created for', async () => {
  const jwt = sessionContainer({ userId: 'admin-2' }).resolve(Jwt)
  const { refresh } = await jwt.createToken(undefined, { audience: 'admin' })

  const authInfo = await jwt.findRefreshTokenAuthInfo(refresh!.token!, { audience: 'admin' })
  assert.equal((authInfo as any).userId, 'admin-2')

  await assert.rejects(
    () => jwt.findRefreshTokenAuthInfo(refresh!.token!, { audience: 'client' }),
    /Invalid refresh token/,
  )
})

test('an unscoped refresh token cannot renew a scoped session', async () => {
  const jwt = sessionContainer({ userId: 'u2' }).resolve(Jwt)
  const { refresh } = await jwt.createToken()

  // Still valid when no audience is required (unchanged behaviour).
  await jwt.findRefreshTokenAuthInfo(refresh!.token!)

  await assert.rejects(
    () => jwt.findRefreshTokenAuthInfo(refresh!.token!, { audience: 'admin' }),
    /Invalid refresh token/,
  )
})

test('signing from a stored refresh token keeps its audience', async () => {
  const signer = sessionContainer({ userId: 'admin-3' }).resolve(JwtSigner)
  const refreshToken = entityFixture(
    JwtRefreshToken,
    {
      authInfo: { userId: 'admin-3' },
      audience: 'admin',
      expirationTime: Date.now() + 3600_000,
    },
    { id: 'rt-audience-1' },
  )

  const access = await signer.signAccessToken(refreshToken)

  assert.equal(decode(access.token).aud, 'admin')
})
