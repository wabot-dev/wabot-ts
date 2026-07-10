import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import type { Response } from 'express'

import { inject } from '@/core/injection'
import { EXPRESS_RES, onGet, restController } from '@/feature/rest-controller'
import { createRestHarness, RestHarness } from '@/testing'

@restController('/raw')
class RawController {
  constructor(@inject(EXPRESS_RES) private res: Response) {}

  @onGet('/css')
  css() {
    this.res
      .type('text/css')
      .set('Cache-Control', 'public, max-age=60')
      .send('body{color:red}')
  }
}

let harness: RestHarness

before(async () => {
  harness = await createRestHarness({ controllers: [RawController] })
})

after(async () => {
  await harness.close()
})

test('a handler can send a raw non-JSON body via EXPRESS_RES (no double-send)', async () => {
  const res = await harness.request('GET', '/raw/css')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/css/)
  assert.match(res.headers.get('cache-control') ?? '', /max-age=60/)
  assert.equal(res.body, 'body{color:red}')
})
