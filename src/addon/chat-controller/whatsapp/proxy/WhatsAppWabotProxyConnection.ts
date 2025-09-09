import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { io, type Socket } from 'socket.io-client'

@singleton()
export class WhatsAppWabotProxyConnection {
  private baseUrl: string
  private socket: Socket | null = null
  private apiKey: string
  private logger = new Logger('wabot:whats-app-wabot-proxy-connection')

  constructor(env: Env) {
    this.apiKey = env.requireString('WABOT_API_KEY')
    this.baseUrl = env.requireString('WABOT_PROXY_URL')
  }

  async getSocket(): Promise<Socket> {
    if (this.socket) {
      return this.socket
    }

    return new Promise((resolve, reject) => {
      const socket = io(this.baseUrl, {
        autoConnect: false,
        auth: { token: this.apiKey },
        reconnection: true,
      })

      socket.on('connect', async () => {
        this.socket = socket
        resolve(socket)
      })

      socket.on('connect_error', (err) => {
        reject(new Error('connection error'))
      })

      socket.connect()
    })
  }
}
