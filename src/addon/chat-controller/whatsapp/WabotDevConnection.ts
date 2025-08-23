import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { io, type Socket } from 'socket.io-client'
import { devEmitEvent, type IDevConnectionRequest } from './WabotDevSocketContracts'

@singleton()
export class WabotDevConnection {
  private devProxy: string
  private devProxySocket: Socket | null = null
  private devToken: string
  private logger = new Logger('wabot:dev-connection')

  static isTokenAvailable(): boolean {
    return !!process.env.WABOT_DEV_TOKEN
  }

  constructor() {
    if (!WabotDevConnection.isTokenAvailable()) {
      throw new Error('WABOT_DEV_TOKEN is not set in environment variables')
    }
    this.devToken = process.env.WABOT_DEV_TOKEN!
    this.devProxy = process.env.WABOT_DEV_PROXY ?? 'https://proxy.wabot.dev'
  }

  async getSocket(): Promise<Socket> {
    if (this.devProxySocket) {
      return this.devProxySocket
    }

    return new Promise((resolve, reject) => {
      const devProxySocket = io(this.devProxy, { autoConnect: false })

      devProxySocket.on('connect', async () => {
        try {
          const req: IDevConnectionRequest = {
            token: this.devToken,
          }
          this.logger.debug('dev connection request')
          const ack = await devProxySocket.emitWithAck(devEmitEvent.DEV_CONNECTION, req)
          if (ack != 'OK') {
            return reject(new Error('Dev connection failed'))
          }

          this.logger.debug('success dev connection')
          this.devProxySocket = devProxySocket
          resolve(devProxySocket)
        } catch (err) {
          this.logger.error(err)
          reject(err)
        }
      })

      devProxySocket.connect()
    })
  }
}
