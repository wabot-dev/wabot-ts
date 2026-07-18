import { Server } from 'node:http'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'

import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { HttpServerProvider } from '@/feature/http'
import { SocketServerConfig, SocketServerProvider } from '@/feature/socket'
import { runSocketControllers } from '@/feature/socket-controller'

export interface ISocketHarnessOptions {
  controllers: IConstructor<any>[]
  /** Extra DI registrations visible to controllers and handshake middlewares: [token, instance]. */
  register?: [any, any][]
}

/**
 * Mounts `@socketController` classes on a private Socket.IO server (ephemeral
 * port) and lets a real socket.io-client connect to their namespaces. Exercises
 * the real pipeline: handshake middlewares, the `connection` handler, event
 * dispatch and argument binding.
 */
export class SocketHarness {
  readonly container: DependencyContainer

  private httpServer: Server
  private clients: ClientSocket[] = []
  private baseUrl = ''

  private constructor(options: ISocketHarnessOptions) {
    const child = container.createChildContainer()
    child.register(Container, { useValue: child })
    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }
    this.container = child

    // A fresh, isolated http + socket server (not the app-wide singletons), so
    // harnesses don't collide and each binds its own ephemeral port.
    const httpServerProvider = new HttpServerProvider()
    httpServerProvider.deferListen() // we bind port 0 ourselves, after registering namespaces
    const socketServerProvider = new SocketServerProvider(
      httpServerProvider,
      child.resolve(SocketServerConfig),
    )
    child.registerInstance(HttpServerProvider, httpServerProvider)
    child.registerInstance(SocketServerProvider, socketServerProvider)

    runSocketControllers(options.controllers, { baseContainer: child, socketServerProvider })
    this.httpServer = httpServerProvider.getHttpServer()
  }

  static async create(options: ISocketHarnessOptions): Promise<SocketHarness> {
    const harness = new SocketHarness(options)
    await harness.listen()
    return harness
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.once('error', reject)
      this.httpServer.listen(0, '127.0.0.1', () => {
        const address = this.httpServer.address()
        if (!address || typeof address === 'string') {
          reject(new Error('SocketHarness: could not determine server port'))
          return
        }
        this.baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  }

  get url(): string {
    return this.baseUrl
  }

  /**
   * Connect a socket.io client to a namespace (default `''`). The optional
   * `setup` runs before the connection completes, so you can register listeners
   * in time to catch events the server emits on `connection`. Closed on `close()`.
   */
  async connect(namespace = '', setup?: (socket: ClientSocket) => void): Promise<ClientSocket> {
    const ns = namespace && !namespace.startsWith('/') ? `/${namespace}` : namespace
    const socket = ioClient(`${this.baseUrl}${ns === '/' ? '' : ns}`, { forceNew: true })
    this.clients.push(socket)
    setup?.(socket)
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve())
      socket.once('connect_error', (err) => reject(err))
    })
    return socket
  }

  async close(): Promise<void> {
    for (const client of this.clients) client.close()
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

export function createSocketHarness(options: ISocketHarnessOptions): Promise<SocketHarness> {
  return SocketHarness.create(options)
}

/** Resolve with the first payload of `event`, or reject on timeout. */
export function waitForEvent<T = any>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`Timed out waiting for socket event '${event}'`))
    }, timeoutMs)
    function onEvent(payload: T) {
      clearTimeout(timer)
      resolve(payload)
    }
    socket.once(event, onEvent)
  })
}
