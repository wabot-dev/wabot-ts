import type { IChatMessage } from '@/core'
import { singleton } from '@/injection'
import { Logger } from '@/logger'
import { io, Socket } from 'socket.io-client'
import type { IWhatsAppConnection } from './IWhatsAppConnection'
import { WhatsAppConnection } from './WhatsAppConnection'
import {
  devWhatsappEmitEvent,
  devWhatsAppListentEvent,
  type IDevConnectionRequest,
  type IDevSendWhatsappRequest,
} from './whatsAppDevSocketContracts'

@singleton()
export class WhatsAppDevConnection extends WhatsAppConnection implements IWhatsAppConnection {
  private devProxy: string
  private devProxySocket: Socket
  private devToken?: string
  private connected = false

  constructor() {
    super(new Logger('wabot:whatsapp-dev-connection'))
    this.devProxy = process.env.WABOT_DEV_PROXY ?? 'https://proxy.wabot.dev'
    this.devToken = process.env.WABOT_DEV_TOKEN
    this.devProxySocket = io(this.devProxy, { autoConnect: false })
  }

  async sendWhatsApp(businessNumber: string, to: string, chatMessage: IChatMessage): Promise<void> {
    const req: IDevSendWhatsappRequest = {
      from: businessNumber,
      to,
      message: chatMessage,
    }
    await this.devProxySocket.emitWithAck(devWhatsappEmitEvent.DEV_SEND_WHATSAPP, req)
  }

  connect(): void {
    if (this.connected) {
      return
    }
    this.connected = true
    this.devProxySocket.connect()
    this.devProxySocket.on('connect', async () => {
      if (!this.devToken) {
        return
      }
      try {
        const req: IDevConnectionRequest = {
          token: this.devToken,
        }

        const ack = await this.devProxySocket.emitWithAck(devWhatsappEmitEvent.DEV_CONNECTION, req)
        if (ack != 'OK') {
          return this.logger.debug('dev connection fails')
        }

        this.devProxySocket.on(devWhatsAppListentEvent.DEV_WATSAPP_WEBHOOK, async (payload) => {
          await this.handlePayload(payload)
        })

        return this.logger.debug('success dev connection')
      } catch (err) {
        this.logger.error(err)
      }
    })
  }
}
