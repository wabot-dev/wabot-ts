import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'node:http'
import { h } from 'preact'
import { container, Container } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { PreactRenderer } from '@/addon/ui/preact'
import { uiController, view } from './metadata'
import { IslandRegistry } from './island'
import { UiRendererRegistry } from './renderer'
import { registerUiControllers } from './runUiControllers'
import { UiBundler, mountUiDevAssets, pageAssetsFromManifest } from './bundler'
import GreeterIsland from './__fixtures__/Greeter.island'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const clientUiModule = path.resolve(repoRoot, 'src/ui/client.ts')
const islandFile = path.resolve(here, '__fixtures__/Greeter.island.tsx')

@uiController('/greet')
class GreeterController {
  @view()
  index() {
    return h('main', null, h('h1', null, 'Greet'), h(GreeterIsland as any, { name: 'World' }))
  }
}

let server: Server
let baseUrl = ''
let bundler: UiBundler
let islandId = ''

test.before(async () => {
  const child = container.createChildContainer()
  child.register(Container, { useValue: child })
  child.resolve(UiRendererRegistry).setDefault(new PreactRenderer())

  const islands = await child.resolve(IslandRegistry).discover([islandFile], repoRoot)
  islandId = islands[0].id

  bundler = new UiBundler({
    islands,
    client: child.resolve(UiRendererRegistry).get().client!,
    cwd: repoRoot,
    alias: { '@/ui': clientUiModule },
  })
  await bundler.startDev()

  const httpServerProvider = new HttpServerProvider()
  const expressProvider = new ExpressProvider(httpServerProvider)
  mountUiDevAssets(expressProvider.getExpress(), bundler)
  registerUiControllers([GreeterController], {
    baseContainer: child,
    expressProvider,
    pageAssets: (used) =>
      pageAssetsFromManifest(bundler.getManifest(), used, {
        liveReloadPath: '/_wabot/livereload',
      }),
  })

  server = httpServerProvider.getHttpServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`
})

test.after(async () => {
  await bundler.dispose()
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test.describe('island dev server', () => {
  test('SSR envuelve el island y referencia su bundle de cliente', async () => {
    const html = await (await fetch(`${baseUrl}/greet`)).text()

    assert.match(html, new RegExp(`<wabot-island data-island="${islandId}"`))
    assert.match(html, /data-props="{&quot;name&quot;:&quot;World&quot;}"/)
    assert.match(html, /<button>Hello World<\/button>/)
    assert.match(html, new RegExp(`<script type="module" src="/_wabot/${islandId}\\.js">`))
    assert.match(html, /EventSource\("\/_wabot\/livereload"\)/)
  })

  test('el bundle de cliente del island se sirve y se auto-registra', async () => {
    const jsUrl = bundler.getManifest().islands[islandId].js
    const res = await fetch(`${baseUrl}${jsUrl}`)
    const code = await res.text()

    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /javascript/)
    assert.match(code, new RegExp(islandId))
    assert.match(code, /Hello/)
  })
})
