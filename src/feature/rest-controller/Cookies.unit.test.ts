import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

import { createRestHarness, RestHarness } from '@/testing'
import { Cookies } from './Cookies'
import { onGet, onPost, restController } from '@/feature/rest-controller'

@restController('/cookies')
class CookieTestController {
  constructor(private cookies: Cookies) {}

  @onPost('/set')
  set() {
    this.cookies.set('pref', 'dark', { httpOnly: true, sameSite: 'lax' })
    return { ok: true }
  }

  @onGet('/read')
  read() {
    return { pref: this.cookies.get('pref') ?? null, all: this.cookies.getAll() }
  }

  @onPost('/clear')
  clear() {
    this.cookies.clear('pref')
    return { ok: true }
  }
}

let harness: RestHarness

before(async () => {
  harness = await createRestHarness({ controllers: [CookieTestController] })
})

after(async () => {
  await harness.close()
})

test('set() writes a cookie on the response (proves EXPRESS_RES resolves to res)', async () => {
  const res = await harness.request('POST', '/cookies/set')
  const setCookie = res.headers.get('set-cookie') ?? ''
  assert.match(setCookie, /pref=dark/)
  assert.match(setCookie, /HttpOnly/i)
})

test('get()/getAll() read cookies from the request', async () => {
  const res = await harness.request('GET', '/cookies/read', {
    headers: { Cookie: 'pref=blue; lang=es' },
  })
  assert.equal(res.body.pref, 'blue')
  assert.equal(res.body.all.lang, 'es')
})

test('clear() expires the cookie', async () => {
  const res = await harness.request('POST', '/cookies/clear')
  assert.match(res.headers.get('set-cookie') ?? '', /pref=/)
})
