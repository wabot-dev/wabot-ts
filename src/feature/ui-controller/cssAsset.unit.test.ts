import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { h } from 'preact'

import { buildCssAssetSource } from '@/ui/cssModuleCompile'
import { registerCssAsset } from '@/ui/cssRegistry'
import { uiController, view } from '@/feature/ui-controller'
import { createUiHarness, UiHarness } from '@/testing'

@uiController('/dummy')
class DummyController {
  @view()
  index() {
    return h('main', null, 'ok')
  }
}

let harness: UiHarness

before(async () => {
  harness = await createUiHarness({ controllers: [DummyController] })
})

after(async () => {
  await harness.close()
})

test('buildCssAssetSource exports the served URL and registers the CSS', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wabot-css-'))
  try {
    const file = join(dir, 'x.css')
    await writeFile(file, 'body{color:red}')
    const source = await buildCssAssetSource(file)
    assert.match(source, /export default "\/_wabot\/css\/[a-f0-9]+\.css"/)
    assert.match(source, /registerCssAsset/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the UI runner serves a registered css asset with an immutable cache', async () => {
  registerCssAsset('deadbeef', 'body{color:red}')
  const res = await harness.get('/_wabot/css/deadbeef.css')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/css/)
  assert.match(res.headers.get('cache-control') ?? '', /immutable/)
  assert.match(res.text, /color:red/)
})

test('an unknown css asset returns 404', async () => {
  const res = await harness.get('/_wabot/css/does-not-exist.css')
  assert.equal(res.status, 404)
})
