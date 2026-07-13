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
}
