import { container, singleton } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { Server } from 'node:http'

/**
 * How long a closing server waits for open connections before cutting them.
 * `server.close()` only stops new connections: it resolves when the last socket
 * goes away, so a single streaming response (SSE, a hanging fetch) keeps it
 * open forever and the shutdown burns its whole deadline. In production that
 * wait is worth a few seconds so real requests finish; in dev it is the reason
 * Ctrl+C seems not to work, so it is nearly immediate.
 */
export function httpDrainGraceMs(): number {
  const fallback = process.env.NODE_ENV === 'production' ? 10 : 0.5
  return (
    container.resolve(Env).requireNumber('WABOT_HTTP_DRAIN_TIMEOUT_SECONDS', {
      default: fallback,
    }) * 1000
  )
}

/**
 * Free idle keep-alive sockets now, and cut whatever is still connected once
 * the grace period passes. Returns a cancel function for the happy path, where
 * the server closes on its own first.
 */
export function drainConnections(server: Server, graceMs: number): () => void {
  // Node 18.2+ / Bun-guarded: sockets with no in-flight request never had a
  // reason to hold the drain open.
  server.closeIdleConnections?.()
  const timer = setTimeout(() => server.closeAllConnections?.(), graceMs)
  timer.unref()
  return () => clearTimeout(timer)
}

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
   * Stop accepting new connections and let in-flight requests finish. Idle
   * keep-alive sockets are freed immediately; anything still connected after
   * the drain grace period ({@link httpDrainGraceMs}) is cut, so one streaming
   * response can no longer hold the whole shutdown open. Resolves once the
   * server has fully closed (or immediately if it never opened).
   */
  async close(graceMs: number = httpDrainGraceMs()): Promise<void> {
    const server = this.server
    if (!server || !this.listening) {
      return
    }
    this.listening = false

    let cancelDrain: (() => void) | undefined
    await new Promise<void>((resolve) => {
      server.close(() => {
        this.logger.info('HTTP server closed')
        resolve()
      })
      cancelDrain = drainConnections(server, graceMs)
    })
    cancelDrain?.()

    this.server = null
  }
}
