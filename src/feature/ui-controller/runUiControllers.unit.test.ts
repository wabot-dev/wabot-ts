import test from 'node:test'
import assert from 'node:assert/strict'
import { Server } from 'node:http'
import { h } from 'preact'
import { container, Container } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { PreactRenderer } from '@/addon/ui/preact'
import { uiController, view, action } from './metadata'
import { redirect } from './document'
import { UiRendererRegistry } from './renderer'
import { registerUiControllers } from './runUiControllers'

// Views use h() instead of JSX so the test runs under the current loader.
@uiController('/my/ui')
class MyUiController {
  @view()
  index() {
    return h('main', null, h('h1', null, 'Main Page'), h('p', null, 'Hi'))
  }

  @view('other-page/here')
  otherPage() {
    return h('section', null, 'Other')
  }

  @action()
  addTodo() {
    return redirect('/my/ui')
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
  registerUiControllers([MyUiController], { baseContainer: child, expressProvider })

  server = httpServerProvider.getHttpServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${(address as any).port}`
})

test.after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test.describe('runUiControllers', () => {
  test('renderiza la vista index como documento HTML', async () => {
    const res = await fetch(`${baseUrl}/my/ui`)
    const html = await res.text()

    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
    assert.ok(html.startsWith('<!doctype html>'))
    assert.match(html, /<main><h1>Main Page<\/h1><p>Hi<\/p><\/main>/)
  })

  test('monta vistas con sub-path', async () => {
    const res = await fetch(`${baseUrl}/my/ui/other-page/here`)
    const html = await res.text()

    assert.equal(res.status, 200)
    assert.match(html, /<section>Other<\/section>/)
  })

  test('las acciones se montan como POST y soportan redirect', async () => {
    const res = await fetch(`${baseUrl}/my/ui/_action/addTodo`, {
      method: 'POST',
      redirect: 'manual',
    })

    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), '/my/ui')
  })
})
