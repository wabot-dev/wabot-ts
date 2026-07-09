import assert from 'node:assert/strict'
import test from 'node:test'

import { HttpServerProvider } from './HttpServerProvider'

test('the http server is created lazily, only on getHttpServer()', () => {
  const provider = new HttpServerProvider()
  assert.equal(provider.server, null)
  const server = provider.getHttpServer()
  assert.ok(server)
  assert.equal(provider.server, server)
})

test('a project with no http components never creates or opens a server', () => {
  // e.g. a Telegram (long-polling) or cmd-only bot: nothing ever calls
  // getHttpServer() or listen(), so defer/release are harmless no-ops.
  const provider = new HttpServerProvider()
  provider.deferListen()
  provider.releaseListen()
  assert.equal(provider.server, null, 'no http server was created')
})

test('deferred listen does not bind the port until released', () => {
  const provider = new HttpServerProvider()
  const server = provider.getHttpServer()
  provider.deferListen()
  provider.listen() // recorded as pending, but must not bind yet
  assert.equal(server.listening, false)
})
