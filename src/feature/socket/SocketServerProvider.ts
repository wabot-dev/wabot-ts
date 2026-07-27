import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { drainConnections, HttpServerProvider, httpDrainGraceMs } from '@/feature/http'
import { Server } from 'socket.io'
import { SocketServerConfig } from './SocketServerConfig'

@singleton()
export class SocketServerProvider {
  private socketServer: Server | null = null
  private logger = new Logger('wabot:socket')

  constructor(
    private httpServerProvider: HttpServerProvider,
    private config: SocketServerConfig,
  ) {}

  getSocketServer(): Server {
    if (!this.socketServer) {
      this.socketServer = this.createSocketServer()
    }
    return this.socketServer
  }

  listen(): void {
    this.httpServerProvider.listen()
  }

  /** Whether a Socket.IO server has been created and is attached to the port. */
  isActive(): boolean {
    return this.socketServer !== null
  }

  /**
   * Disconnect all clients and close the Socket.IO server. Because Socket.IO is
   * attached to the shared HTTP server, `io.close()` also drains and closes it,
   * so this owns the HTTP shutdown whenever a socket server is active. Plain
   * HTTP connections on that shared server are drained the same way as in
   * {@link HttpServerProvider.close} — Socket.IO hangs up its own clients, but
   * an unrelated streaming response would otherwise keep the port open.
   */
  async close(graceMs: number = httpDrainGraceMs()): Promise<void> {
    const io = this.socketServer
    if (!io) return
    this.socketServer = null

    io.removeAllListeners()
    let cancelDrain: (() => void) | undefined
    await new Promise<void>((resolve) => {
      io.close(() => resolve())
      cancelDrain = drainConnections(this.httpServerProvider.getHttpServer(), graceMs)
    })
    cancelDrain?.()
    this.logger.info('socket server closed')
  }

  private createSocketServer(): Server {
    const httpServer = this.httpServerProvider.getHttpServer()
    const socketServer = new Server(httpServer as any, {
      cors: {
        origin: this.config.corsOrigin,
      },
    })

    socketServer.on('connection', (socket) => {
      this.logger.trace(`socket:${socket.id} connection`)

      socket.onAny((event) => {
        this.logger.trace(`socket:${socket.id} emmits ${event}`)
      })

      socket.on('disconnect', (reason) => {
        this.logger.trace(`socket:${socket.id} disconnect with reason: ${reason}`)
      })
    })

    httpServer.on('listening', () => {
      this.logger.info(`socket server listening`)
    })

    return socketServer
  }
}
