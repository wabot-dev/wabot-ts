import test from 'node:test'
import assert from 'node:assert/strict'
import { h } from 'preact'
import { Request, Response } from 'express'
import { injectable } from '@/core/injection'
import { isNotEmpty, isString } from '@/core/validation'
import { IMiddleware } from '@/feature/rest-controller'
import { uiController, view, action, redirect, actionUrl } from '@/feature/ui-controller'
import { createUiHarness, UiHarness } from './uiHarness'

class NameDto {
  @isString()
  @isNotEmpty()
  name?: string
}

@injectable()
class RequireUser implements IMiddleware {
  async handle(req: Request, res: Response): Promise<void> {
    if (req.headers['x-user'] !== 'ok') res.redirect(302, '/login')
  }
}

@uiController('/app')
class AppController {
  @view()
  index() {
    return h('main', null, h('h1', null, 'App'))
  }

  @action()
  ping() {
    return { ok: true }
  }

  @action()
  save() {
    return redirect('/app')
  }

  @action()
  greet(input: NameDto) {
    return { hello: input.name }
  }
}

@uiController({ path: '/admin', middlewares: [RequireUser] })
class AdminController {
  @view()
  index() {
    return h('main', null, 'secret')
  }
}

let harness: UiHarness

test.before(async () => {
  harness = await createUiHarness({ controllers: [AppController, AdminController] })
})

test.after(async () => {
  await harness.close()
})

test.describe('UiHarness', () => {
  test('renderiza una vista como documento HTML', async () => {
    const res = await harness.get('/app')
    assert.equal(res.status, 200)
    assert.match(res.text, /<!doctype html>/)
    assert.match(res.text, /<h1>App<\/h1>/)
  })

  test('una accion que retorna datos responde JSON', async () => {
    const res = await harness.action(actionUrl('/app', 'ping'))
    assert.equal(res.status, 200)
    assert.deepEqual(res.json(), { ok: true })
  })

  test('una accion puede redirigir (PRG)', async () => {
    const res = await harness.action(actionUrl('/app', 'save'), undefined, { redirect: 'manual' })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), '/app')
  })

  test('los parametros de accion se validan como un DTO de rest', async () => {
    const ok = await harness.action(actionUrl('/app', 'greet'), { name: 'Ada' })
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.json(), { hello: 'Ada' })

    const bad = await harness.action(actionUrl('/app', 'greet'), { name: '' })
    assert.equal(bad.status, 400)
  })

  test('los guards de controlador protegen las vistas', async () => {
    const blocked = await harness.get('/admin', { redirect: 'manual' })
    assert.equal(blocked.status, 302)
    assert.equal(blocked.headers.get('location'), '/login')

    const allowed = await harness.get('/admin', { headers: { 'x-user': 'ok' } })
    assert.equal(allowed.status, 200)
    assert.match(allowed.text, /secret/)
  })
})

test.describe('actionUrl', () => {
  test('construye la ruta de la accion', () => {
    assert.equal(actionUrl('/app', 'ping'), '/app/_action/ping')
    assert.equal(actionUrl('/app/', 'ping'), '/app/_action/ping')
  })
})
