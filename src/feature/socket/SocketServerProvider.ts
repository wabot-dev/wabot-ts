import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { HttpServerProvider } from '@/feature/http'
import { Server } from 'socket.io'

@singleton()
export class SocketServerProvider {
  private socketServer: Server | null = null
  private logger = new Logger('wabot:socket')

  constructor(private httpServerProvider: HttpServerProvider) {}

  getSocketServer(): Server {
    if (!this.socketServer) {
      this.socketServer = this.createSocketServer()
    }
    return this.socketServer
  }

  listen(): void {
    this.httpServerProvider.listen()
  }

  private createSocketServer(): Server {
    const httpServer = this.httpServerProvider.getHttpServer()
    const socketServer = new Server(httpServer as any, {
      cors: {
        origin: '*',
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
