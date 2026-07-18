import test from 'node:test'
import assert from 'node:assert/strict'
import { Server } from 'node:http'
import { h } from 'preact'
import { container, Container, injectable } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { IMiddleware } from '@/feature/rest-controller'
import { PreactRenderer } from '@/addon/ui/preact'
import { uiController, view } from './metadata'
import { UiRendererRegistry } from './renderer'
import { registerUiControllers } from './runUiControllers'
import { StaticPageCache } from './StaticPageCache'

// Render counters (module-level: controllers are instantiated per request).
const hits = { plain: 0, isr: 0, guarded: 0 }
const guardRan = { value: false }

@uiController({ path: '/s' })
class StaticController {
  @view({ static: true })
  index() {
    hits.plain++
    return h('main', null, `plain-${hits.plain}`)
  }

  @view({ path: 'isr', static: { revalidate: 1 } })
  isr() {
    hits.isr++
    return h('main', null, `isr-${hits.isr}`)
  }
}

@injectable()
class MarkMiddleware implements IMiddleware {
  async handle() {
    guardRan.value = true
  }
}

@uiController({ path: '/g', middlewares: [MarkMiddleware] })
class GuardedStaticController {
  @view({ static: true })
  index() {
    hits.guarded++
    return h('main', null, `guarded-${hits.guarded}`)
  }
}

let server: Server
let baseUrl = ''
let staticCache: StaticPageCache
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test.before(async () => {
  const child = container.createChildContainer()
  child.register(Container, { useValue: child })
  child.resolve(UiRendererRegistry).setDefault(new PreactRenderer())

  const httpServerProvider = new HttpServerProvider()
  const expressProvider = new ExpressProvider(httpServerProvider)
  registerUiControllers([StaticController, GuardedStaticController], {
    baseContainer: child,
    expressProvider,
    pageAssets: () => ({}),
  })

  staticCache = child.resolve(StaticPageCache)
  // Wait for the startup pre-render of the three non-parameterized static routes.
  const deadline = Date.now() + 2000
  while (staticCache.cachedPaths().length < 3 && Date.now() < deadline) await sleep(10)

  server = httpServerProvider.getHttpServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`
})

test.after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test.describe('static generation (SSG)', () => {
  test('non-parameterized static routes are pre-rendered once at startup', async () => {
    // Pre-render already ran the handler exactly once (before any request).
    assert.equal(hits.plain, 1)
    assert.deepEqual([...staticCache.cachedPaths()].sort(), ['/g', '/s', '/s/isr'])

    // Every request is served from the cache without re-running the handler.
    const a = await (await fetch(`${baseUrl}/s`)).text()
    const b = await (await fetch(`${baseUrl}/s`)).text()
    assert.equal(a, b)
    assert.match(a, /plain-1/)
    assert.equal(hits.plain, 1)
  })

  test('static responses carry an ETag and revalidatable cache headers', async () => {
    const res = await fetch(`${baseUrl}/s`)
    await res.text()
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
    assert.equal(res.headers.get('cache-control'), 'public, max-age=0, must-revalidate')
    const etag = res.headers.get('etag')
    assert.ok(etag, 'ETag present')

    const conditional = await fetch(`${baseUrl}/s`, { headers: { 'If-None-Match': etag! } })
    assert.equal(conditional.status, 304)
    assert.equal(await conditional.text(), '')
  })

  test('a static view skips its middleware/guards (served from the shared cache)', async () => {
    guardRan.value = false
    const res = await fetch(`${baseUrl}/g`)
    const html = await res.text()
    assert.equal(res.status, 200)
    assert.match(html, /guarded-1/)
    assert.equal(guardRan.value, false, 'middleware is not run for a static page')
  })

  test('revalidate: serves stale within the window, regenerates in the background', async () => {
    // Reset this entry so freshness is measured from now (decoupled from boot).
    staticCache.invalidate('/s/isr')
    const first = await (await fetch(`${baseUrl}/s/isr`)).text()
    // Immediate revisit: still fresh, no re-render.
    const cached = await (await fetch(`${baseUrl}/s/isr`)).text()
    assert.equal(cached, first)

    await sleep(1100) // past revalidate:1s
    // Stale-while-revalidate: this request gets the stale body...
    const stale = await (await fetch(`${baseUrl}/s/isr`)).text()
    assert.equal(stale, first)

    await sleep(200) // ...while a fresh copy was generated in the background.
    const fresh = await (await fetch(`${baseUrl}/s/isr`)).text()
    assert.notEqual(fresh, first)
  })

  test('on-demand invalidation forces a re-render on the next request', async () => {
    const before = await (await fetch(`${baseUrl}/s`)).text()
    staticCache.invalidate('/s')
    const after = await (await fetch(`${baseUrl}/s`)).text()
    assert.notEqual(after, before)
    assert.match(after, /plain-\d+/)

    // invalidateAll clears the whole cache.
    staticCache.invalidateAll()
    assert.equal(staticCache.cachedPaths().length, 0)
  })
})
