import { ChatResolver, type IChatChannel, type IReceivedMessage, UserResolver } from '@/controller'
import type { IChatConnection, IChatMessage, IUserConnection } from '@/core'
import { injectable } from '@/injection'
import { Logger } from '@/logger'
import { io, Socket } from 'socket.io-client'
import type {
  IWhatsAppContact,
  IWhatsAppMessage,
  IWhatsAppWebhookPayload,
} from './IWhatsAppWebHookPayload'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import {
  devWhatsappEmitEvent,
  devWhatsAppListentEvent,
  type IDevConnectionRequest,
  type IDevSendWhatsappRequest,
} from './whatsAppDevSocketContracts'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  private devProxy: string
  private devProxySocket: Socket
  private devToken?: string
  private logger = new Logger('wabot:whatsapp-channel')

  constructor(
    private config: WhatsappChannelConfig,
    private chatResolver: ChatResolver,
    private userResolver: UserResolver,
  ) {
    this.devProxy = process.env.WABOT_DEV_PROXY ?? 'https://proxy.wabot.dev'
    this.devToken = process.env.WABOT_DEV_TOKEN
    this.devProxySocket = io(this.devProxy, { autoConnect: false })
  }

  listen(callback: (message: IReceivedMessage) => void): void {
    this.devProxySocket.on(
      devWhatsAppListentEvent.DEV_WATSAPP_WEBHOOK,
      async (payload: IWhatsAppWebhookPayload) => {
        try {
          for (const entry of payload.entry) {
            for (const change of entry.changes) {
              if (change.field !== 'messages' || !change.value.messages || !change.value.contacts) {
                continue
              }
              for (const message of change.value.messages) {
                const contact = change.value.contacts.find((x) => x.wa_id === message.from)
                if (!contact) {
                  continue
                }
                if (change.value.metadata.display_phone_number !== this.config.number) {
                  continue
                }
                await this.handleMessage(message, contact, callback)
              }
            }
          }
        } catch (err) {
          this.logger.error(err)
        }
      },
    )
  }

  connect(): void {
    if (this.devToken) {
      this.connectDevProxySocket(this.devToken)
    }
  }

  private async handleMessage(
    message: IWhatsAppMessage,
    contact: IWhatsAppContact,
    callback: (message: IReceivedMessage) => void,
  ) {
    if (message.type !== 'text') {
      this.logger.error(`message type ${message.type} is not supported yet`)
      return
    }

    const chatConnection: IChatConnection = {
      id: contact.wa_id,
      chatType: 'PRIVATE',
      channelName: WhatsAppChannel.name,
    }

    const chat = await this.chatResolver.resolve(chatConnection)

    const userConnection: IUserConnection = {
      id: contact.wa_id,
      channelName: WhatsAppChannel.name,
    }

    const user = await this.userResolver.resolve(userConnection)

    callback({
      chat,
      user,
      message: {
        chatConnection,
        userConnection,
        senderName: contact.profile.name,
        text: message.text.body,
      },
      reply: (replyMessage: IChatMessage) => {
        this.sendWhatsApp(contact, replyMessage)
      },
    })
  }

  private async sendWhatsApp(contact: IWhatsAppContact, replyMessage: IChatMessage) {
    const req: IDevSendWhatsappRequest = {
      from: this.config.number,
      to: contact.wa_id,
      message: replyMessage,
    }
    await this.devProxySocket.emitWithAck(devWhatsappEmitEvent.DEV_SEND_WHATSAPP, req)
  }

  private connectDevProxySocket(token: string) {
    this.devProxySocket.connect()
    this.devProxySocket.on('connect', async () => {
      try {
        const req: IDevConnectionRequest = {
          token,
        }

        const ack = await this.devProxySocket.emitWithAck(devWhatsappEmitEvent.DEV_CONNECTION, req)
        if (ack != 'OK') {
          return this.logger.debug('dev connection fails')
        }
        return this.logger.debug('success dev connection')
      } catch (err) {
        this.logger.error(err)
      }
    })
  }
}
