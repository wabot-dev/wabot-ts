import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Server } from 'http'

@singleton()
export class HttpServerProvider {
  server: Server | null = null
  private listening: boolean = false
  private logger = new Logger('wabot:http')

  getHttpServer(): Server {
    if (!this.server) {
      this.server = new Server()
    }
    return this.server
  }

  listen(): void {
    if (!this.server || this.listening) {
      return
    }
    this.listening = true
    const PORT = process.env.PORT || 3000

    this.server.listen(PORT, () => {
      this.logger.info(`server listenig on port ${PORT}`)
    })
  }
}
