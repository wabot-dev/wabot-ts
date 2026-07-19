import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Server } from 'node:http'

@singleton()
export class HttpServerProvider {
  server: Server | null = null
  private listening: boolean = false
  private deferred: boolean = false
  private pendingListen: boolean = false
  private logger = new Logger('wabot:http')

  getHttpServer(): Server {
    if (!this.server) {
      this.server = new Server()
    }
    return this.server
  }

  /**
   * Hold off actually opening the port. While deferred, `listen()` records the
   * request but does not bind, so all routes and Socket.IO namespaces can be
   * registered first — otherwise a client connecting during boot can hit a
   * namespace that is not registered yet (Socket.IO answers "Invalid namespace",
   * which socket.io-client treats as fatal and never retries).
   */
  deferListen(): void {
    this.deferred = true
  }

  /** Open the port now if a listen was requested while deferred, and stop deferring. */
  releaseListen(): void {
    this.deferred = false
    if (this.pendingListen) {
      this.open()
    }
  }

  listen(): void {
    if (!this.server || this.listening) {
      return
    }
    if (this.deferred) {
      this.pendingListen = true
      return
    }
    this.open()
  }

  private open(): void {
    if (!this.server || this.listening) {
      return
    }
    this.listening = true
    const PORT = process.env.PORT || 3000

    this.server.listen(PORT, () => {
      this.logger.info(`Server listening on port ${PORT}`)
    })
  }

  /**
   * Stop accepting new connections and wait for in-flight requests to finish.
   * Idle keep-alive sockets are closed immediately so they do not hold the
   * drain open; active requests keep their sockets and complete normally.
   * Resolves once the server has fully closed (or immediately if it never
   * opened). Bounded by the caller's overall shutdown deadline.
   */
  async close(): Promise<void> {
    const server = this.server
    if (!server || !this.listening) {
      return
    }
    this.listening = false

    await new Promise<void>((resolve) => {
      server.close(() => {
        this.logger.info('HTTP server closed')
        resolve()
      })
      // Node 18.2+ / Bun-guarded: free idle keep-alive sockets so `close()` is
      // not held open waiting on connections with no in-flight request.
      server.closeIdleConnections?.()
    })

    this.server = null
  }
}
