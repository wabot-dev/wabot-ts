import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { h } from 'preact'

import { uiController, view } from '@/feature/ui-controller'
import { createUiHarness, UiHarness } from '@/testing'

@uiController({ path: '/styled', head: { stylesheets: ['/assets/design.css'] } })
class StyledController {
  @view()
  index() {
    return h('main', null, h('h1', null, 'Styled'))
  }
}

let harness: UiHarness

before(async () => {
  harness = await createUiHarness({ controllers: [StyledController] })
})

after(async () => {
  await harness.close()
})

test('head.stylesheets renders a cacheable <link rel="stylesheet"> in the head', async () => {
  const res = await harness.get('/styled')
  assert.equal(res.status, 200)
  const head = res.text.split('<body>')[0]
  assert.match(head, /<link rel="stylesheet" href="\/assets\/design\.css">/)
})
