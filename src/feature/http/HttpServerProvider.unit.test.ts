import assert from 'node:assert/strict'
import test from 'node:test'
import type { AddressInfo } from 'node:net'

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

test('close() does not hang on a streaming response: it cuts it after the grace', async () => {
  const provider = new HttpServerProvider()
  const server = provider.getHttpServer()
  server.on('request', (_req, res) => {
    // An endpoint that never ends its response — SSE, a live-reload stream, a
    // hanging fetch. `server.close()` alone waits for it forever.
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write('data: hi\n\n')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  provider['listening'] = true
  const { port } = server.address() as AddressInfo

  const open = new AbortController()
  const stream = await fetch(`http://127.0.0.1:${port}/sse`, { signal: open.signal })
  await stream.body!.getReader().read()

  const start = Date.now()
  await provider.close(100)
  const elapsed = Date.now() - start

  assert.ok(elapsed >= 100, `waited for the grace period (${elapsed}ms)`)
  assert.ok(elapsed < 2000, `but did not hang on the open stream (${elapsed}ms)`)
  open.abort()
})

test('close() resolves at once when nothing is connected', async () => {
  const provider = new HttpServerProvider()
  const server = provider.getHttpServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  provider['listening'] = true

  const start = Date.now()
  await provider.close(5000)

  assert.ok(Date.now() - start < 1000, 'the grace period is a deadline, not a delay')
})
