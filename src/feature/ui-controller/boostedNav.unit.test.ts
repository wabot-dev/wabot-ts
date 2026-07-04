import test from 'node:test'
import assert from 'node:assert/strict'
import { Server } from 'node:http'
import { h } from 'preact'
import { container, Container } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { PreactRenderer, Outlet } from '@/addon/ui/preact'
import { uiController, view } from './metadata'
import { UiRendererRegistry } from './renderer'
import { registerUiControllers } from './runUiControllers'
import { matchesRoute } from './bundler/navRuntime'

@uiController({ path: '/app', app: true })
class AppController {
  @view()
  index() {
    return h('main', null, 'home')
  }
}

@uiController('/plain')
class PlainController {
  @view()
  index() {
    return h('main', null, 'plain')
  }
}

function ShellLayout() {
  return h('div', { class: 'shell' }, h('nav', null, 'NAVBAR'), h(Outlet, {}))
}

@uiController({ path: '/shell', app: true, layout: ShellLayout })
class ShellController {
  @view()
  index() {
    return h('main', null, 'view-body')
  }
}

let rev = 'v1'

@uiController({ path: '/versioned', app: true })
class VersionedController {
  @view({ swr: { version: () => rev } })
  index() {
    return h('main', null, 'versioned')
  }
}

@uiController({ path: '/multi', app: true })
class MultiController {
  @view()
  index() {
    return h('main', null, 'm-index')
  }
  @view('a')
  a() {
    return h('main', null, 'm-a')
  }
  @view('b')
  b() {
    return h('main', null, 'm-b')
  }
}

@uiController({ path: '/docs', app: true })
class DocsController {
  @view({ path: 'page/:id', swr: { version: (r: any) => `p${r.id}` } })
  page() {
    return h('main', null, 'doc-page')
  }
}

@uiController({
  path: '/fonts',
  app: true,
  head: {
    preconnect: [{ href: 'https://fonts.gstatic.com', crossorigin: true }],
    preload: [{ href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2' }],
  },
})
class FontsController {
  @view()
  index() {
    return h('main', null, 'fonts')
  }
}

let server: Server
let baseUrl = ''

test.before(async () => {
  const child = container.createChildContainer()
  child.register(Container, { useValue: child })
  child.resolve(UiRendererRegistry).setDefault(new PreactRenderer())

  const httpServerProvider = new HttpServerProvider()
  const expressProvider = new ExpressProvider(httpServerProvider)
  registerUiControllers(
    [
      AppController,
      PlainController,
      ShellController,
      VersionedController,
      MultiController,
      DocsController,
      FontsController,
    ],
    {
      baseContainer: child,
      expressProvider,
      // Stub the bundler hook so `app` pages get the nav bootstrap injected.
      pageAssets: () => ({ navScript: '/_wabot/_nav.js' }),
    },
  )

  server = httpServerProvider.getHttpServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`
})

test.after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test.describe('boosted navigation', () => {
  test('sin header X-Wabot-Nav sirve el documento completo', async () => {
    const res = await fetch(`${baseUrl}/app`)
    const html = await res.text()
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
    assert.ok(html.startsWith('<!doctype html>'))
  })

  test('con header X-Wabot-Nav sirve un fragmento JSON con ETag', async () => {
    const res = await fetch(`${baseUrl}/app`, { headers: { 'X-Wabot-Nav': '1' } })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /application\/json/)
    assert.ok(res.headers.get('etag'), 'debe incluir ETag')

    const body = await res.json()
    assert.match(body.html, /<main>home<\/main>/)
    assert.ok(!String(body.html).includes('<!doctype'), 'el fragmento no trae el shell')
    assert.equal(body.maxAge, 0)
  })

  test('If-None-Match coincidente responde 304 sin cuerpo', async () => {
    const first = await fetch(`${baseUrl}/app`, { headers: { 'X-Wabot-Nav': '1' } })
    const etag = first.headers.get('etag')!
    await first.text()

    const second = await fetch(`${baseUrl}/app`, {
      headers: { 'X-Wabot-Nav': '1', 'If-None-Match': etag },
    })
    assert.equal(second.status, 304)
    assert.equal(await second.text(), '')
  })

  test('los controllers sin app: true ignoran el header y sirven HTML', async () => {
    const res = await fetch(`${baseUrl}/plain`, { headers: { 'X-Wabot-Nav': '1' } })
    const html = await res.text()
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
    assert.ok(html.startsWith('<!doctype html>'))
  })

  test('la carga completa envuelve la vista en el layout con <wabot-outlet>', async () => {
    const res = await fetch(`${baseUrl}/shell`)
    const html = await res.text()
    assert.equal(res.status, 200)
    assert.match(html, /NAVBAR/) // shell
    assert.match(html, /<wabot-outlet/) // outlet host
    assert.match(html, /view-body/) // view inside the outlet
  })

  test('la navegación boosted devuelve solo la vista (sin shell ni outlet)', async () => {
    const res = await fetch(`${baseUrl}/shell`, { headers: { 'X-Wabot-Nav': '1' } })
    const body = await res.json()
    assert.equal(res.status, 200)
    assert.match(body.html, /view-body/)
    assert.ok(!String(body.html).includes('NAVBAR'), 'el fragmento no reenvía el shell')
    assert.ok(
      !String(body.html).includes('wabot-outlet'),
      'el fragmento es el contenido del outlet',
    )
  })

  test('el bootstrap embebe las rutas declaradas del controller (no un scope amplio)', async () => {
    const res = await fetch(`${baseUrl}/multi`)
    const html = await res.text()
    const match = html.match(/window\.__wabotApp=(\{.*?\})<\/script>/)
    assert.ok(match, 'debe inyectar el bootstrap de navegación')
    const app = JSON.parse(match![1].replace(/\\u003c/g, '<'))
    assert.deepEqual([...app.routes].sort(), ['/multi', '/multi/a', '/multi/b'])
    assert.ok(!('scope' in app), 'ya no usa un scope de prefijo')
  })

  test('head del controller inyecta preconnect/preload (con crossorigin por defecto en fuentes)', async () => {
    const html = await (await fetch(`${baseUrl}/fonts`)).text()
    assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/)
    // as:'font' sin crossorigin explícito => se añade solo (evita doble fetch)
    assert.match(
      html,
      /<link rel="preload" href="\/fonts\/inter\.woff2" as="font" type="font\/woff2" crossorigin>/,
    )
  })

  test('el fragmento boosted no reenvía los head links (el <head> persiste)', async () => {
    const body = await (await fetch(`${baseUrl}/fonts`, { headers: { 'X-Wabot-Nav': '1' } })).json()
    assert.ok(!String(body.html).includes('preload'), 'el head no viaja en el fragmento')
  })

  test('matchesRoute: patrones con :param y literales', () => {
    const routes = ['/docs/page/:id', '/multi', '/multi/a']
    assert.ok(matchesRoute('/docs/page/7', routes))
    assert.ok(matchesRoute('/docs/page/abc-123', routes))
    assert.ok(!matchesRoute('/docs/page', routes)) // falta el segmento del param
    assert.ok(!matchesRoute('/docs/page/7/extra', routes)) // segmento de más
    assert.ok(matchesRoute('/multi/a', routes)) // literal exacto
    assert.ok(!matchesRoute('/multi/c', routes)) // no declarada
  })

  test('la ruta con :param se soft-navega y su swr key depende del parámetro', async () => {
    // El bootstrap publica el patrón, no una ruta concreta.
    const doc = await (await fetch(`${baseUrl}/docs/page/7`)).text()
    const app = JSON.parse(
      doc.match(/window\.__wabotApp=(\{.*?\})<\/script>/)![1].replace(/\\u003c/g, '<'),
    )
    assert.deepEqual(app.routes, ['/docs/page/:id'])

    // El ETag (swr key) se deriva del parámetro.
    const p7 = await fetch(`${baseUrl}/docs/page/7`, { headers: { 'X-Wabot-Nav': '1' } })
    await p7.text()
    assert.equal(p7.headers.get('etag'), '"v:p7"')

    const p8 = await fetch(`${baseUrl}/docs/page/8`, { headers: { 'X-Wabot-Nav': '1' } })
    await p8.text()
    assert.equal(p8.headers.get('etag'), '"v:p8"')

    // 304 por-parámetro: la key de 7 no revalida a 8.
    const revalidate7 = await fetch(`${baseUrl}/docs/page/7`, {
      headers: { 'X-Wabot-Nav': '1', 'If-None-Match': '"v:p7"' },
    })
    assert.equal(revalidate7.status, 304)

    const cross = await fetch(`${baseUrl}/docs/page/8`, {
      headers: { 'X-Wabot-Nav': '1', 'If-None-Match': '"v:p7"' },
    })
    assert.equal(cross.status, 200)
    assert.equal(cross.headers.get('etag'), '"v:p8"')
  })

  test('version key: 304 sin re-render cuando coincide, 200 al cambiar', async () => {
    rev = 'v1'
    const first = await fetch(`${baseUrl}/versioned`, { headers: { 'X-Wabot-Nav': '1' } })
    await first.text()
    assert.equal(first.headers.get('etag'), '"v:v1"')

    const cached = await fetch(`${baseUrl}/versioned`, {
      headers: { 'X-Wabot-Nav': '1', 'If-None-Match': '"v:v1"' },
    })
    assert.equal(cached.status, 304)

    rev = 'v2'
    const changed = await fetch(`${baseUrl}/versioned`, {
      headers: { 'X-Wabot-Nav': '1', 'If-None-Match': '"v:v1"' },
    })
    assert.equal(changed.status, 200)
    assert.equal(changed.headers.get('etag'), '"v:v2"')
  })
})
