import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { Socket } from 'socket.io'

import { isNotEmpty, isString } from '@/core/validation'
import { onSocketEvent, socketController } from '@/feature/socket-controller'

import { createSocketHarness, SocketHarness, waitForEvent } from './socketHarness'

class EchoRequest {
  @isString()
  @isNotEmpty()
  text!: string
}

@socketController('room')
class RoomSocketController {
  // Method name is `onConnect`, NOT `connection`. This is the regression for the
  // bug where the connection handler was looked up by method name and never fired.
  @onSocketEvent('connection')
  async onConnect(socket: Socket) {
    socket.emit('welcome', { hello: true })
  }

  // Socket-only handler: the framework must recognize the first param as the Socket.
  @onSocketEvent('ping')
  async onPing(socket: Socket) {
    socket.emit('pong', { ok: true })
  }

  // (req, socket) handler: the request DTO is validated, the socket is injected.
  @onSocketEvent('echo')
  async onEcho(req: EchoRequest, socket: Socket) {
    socket.emit('echoed', { text: req.text.toUpperCase() })
  }
}

let harness: SocketHarness

before(async () => {
  harness = await createSocketHarness({ controllers: [RoomSocketController] })
})

after(async () => {
  await harness.close()
})

test('the connection handler fires even when its method is not named "connection"', async () => {
  let welcome!: Promise<{ hello: boolean }>
  await harness.connect('room', (socket) => {
    welcome = waitForEvent(socket, 'welcome')
  })
  assert.deepEqual(await welcome, { hello: true })
})

test('a socket-only event handler receives the socket and can reply', async () => {
  const socket = await harness.connect('room')
  socket.emit('ping')
  assert.deepEqual(await waitForEvent(socket, 'pong'), { ok: true })
})

test('a (req, socket) handler validates the request and replies', async () => {
  const socket = await harness.connect('room')
  socket.emit('echo', { text: 'hola' })
  assert.deepEqual(await waitForEvent(socket, 'echoed'), { text: 'HOLA' })
})
