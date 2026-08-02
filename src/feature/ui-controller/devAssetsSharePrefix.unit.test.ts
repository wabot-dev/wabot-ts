// The island dev middleware and the plain-CSS asset registry both live under
// `/_wabot/`, and the middleware is mounted first — before the UI controllers
// exist. It used to answer 404 for anything the bundler did not have, which
// made every stylesheet passed to `@uiController({ head: { stylesheets } })`
// unreachable in dev as soon as an app gained its first island.
//
// These mount the two in the order ProjectRunner does, which is the part no
// test covered: the dev middleware's own tests stub the bundler and never
// register the CSS route, and the CSS route's tests never mount the middleware.

import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { Server } from 'node:http'
import { h } from 'preact'

import { container, Container } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import {
  registerUiControllers,
  uiController,
  UiRendererRegistry,
  view,
} from '@/feature/ui-controller'
import { PreactRenderer } from '@/addon/ui/preact'
import { mountUiDevAssets, type IUiDevAssets } from '@/feature/ui-controller/bundler/devMiddleware'
import type { UiBundler } from '@/feature/ui-controller/bundler/UiBundler'
import { registerCssAsset } from '@/ui/cssRegistry'

@uiController('/dummy')
class DummyController {
  @view()
  index() {
    return h('main', null, 'ok')
  }
}

/** A bundler holding exactly one island bundle, like a dev build would. */
function stubBundler(): UiBundler {
  const files: Record<string, { contents: Uint8Array; type: string; immutable: boolean }> = {
    '/_wabot/counter.js': {
      contents: new TextEncoder().encode('export const island = 1'),
      type: 'text/javascript; charset=utf-8',
      immutable: false,
    },
  }
  return {
    onRebuild: () => {},
    getFile: async (servePath: string) => files[servePath],
  } as unknown as UiBundler
}

let server: Server
let devAssets: IUiDevAssets
let baseUrl = ''

before(async () => {
  const httpServerProvider = new HttpServerProvider()
  const expressProvider = new ExpressProvider(httpServerProvider)
  const child = container.createChildContainer()
  child.register(Container, { useValue: child })

  const rendererRegistry = child.resolve(UiRendererRegistry)
  if (!rendererRegistry.hasDefault()) rendererRegistry.setDefault(new PreactRenderer())

  // ProjectRunner's order: dev assets first, controllers second, the
  // "asset not found" responder last.
  devAssets = await mountUiDevAssets(expressProvider.getExpress(), stubBundler(), {
    liveReloadPort: 43411,
  })
  registerUiControllers([DummyController], { baseContainer: child, expressProvider })
  devAssets.mountNotFound()

  registerCssAsset('cafe1234', 'body{color:red}')

  server = httpServerProvider.getHttpServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

after(async () => {
  await devAssets.close()
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test('a registered stylesheet is served, not swallowed by the island bundler', async () => {
  const res = await fetch(`${baseUrl}/_wabot/css/cafe1234.css`)

  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/css/)
  assert.match(await res.text(), /color:red/)
})

test('the bundler still serves its own assets', async () => {
  const res = await fetch(`${baseUrl}/_wabot/counter.js`)

  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /javascript/)
  assert.match(await res.text(), /export const island/)
})

test('an unknown stylesheet is a 404 from the registry that owns the namespace', async () => {
  const res = await fetch(`${baseUrl}/_wabot/css/deadbeef.css`)

  assert.equal(res.status, 404)
})

test('an asset nothing claims still answers in its own language', async () => {
  const js = await fetch(`${baseUrl}/_wabot/renamed-away.js`)
  assert.equal(js.status, 404)
  assert.match(js.headers.get('content-type') ?? '', /javascript/)
  assert.match(await js.text(), /dev asset not found/)

  const css = await fetch(`${baseUrl}/_wabot/renamed-away.css`)
  assert.equal(css.status, 404)
  assert.match(css.headers.get('content-type') ?? '', /text\/css/)
})

test('the app itself is unaffected', async () => {
  const res = await fetch(`${baseUrl}/dummy`)

  assert.equal(res.status, 200)
  assert.match(await res.text(), /<main>ok<\/main>/)
})
