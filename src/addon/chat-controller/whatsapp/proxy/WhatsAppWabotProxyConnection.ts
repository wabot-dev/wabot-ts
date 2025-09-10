import { Env } from '@/core/env'
import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { io, type Socket } from 'socket.io-client'

@injectable()
export class WhatsAppWabotProxyConnection {
  private baseUrl: string
  private socket: Socket | null = null
  private apiKey: string
  private logger = new Logger('wabot:whats-app-wabot-proxy-connection')

  constructor(env: Env) {
    this.apiKey = env.requireString('WABOT_API_KEY')
    this.baseUrl = env.requireString('WABOT_PROXY_URL')
    while (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.substring(0, this.baseUrl.length - 1)
    }
  }

  async getSocket(): Promise<Socket> {
    if (this.socket) {
      return this.socket
    }

    return new Promise((resolve, reject) => {
      const socket = io(`${this.baseUrl}/whats-app`, {
        autoConnect: false,
        auth: { token: this.apiKey },
        reconnection: true,
      })

      socket.on('connect', async () => {
        this.socket = socket
        resolve(socket)
      })

      socket.on('connect_error', (err) => {
        reject(new Error(err && err.message ? err.message : 'connection error', { cause: err }))
      })

      socket.connect()
    })
  }
}
