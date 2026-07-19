import { type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'
import { Env } from '@/core/env'

import { Logger } from '@/core/logger'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import { WhatsAppApiReceiver } from './WhatsAppApiReceiver'
import { WhatsAppApiSender } from './WhatsAppApiSender'
import { IWhatsAppChannelMessage } from './IWhatsAppChannelMessage'
import { whatsAppChannelName } from './whatsAppChannelName'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  static channelName = whatsAppChannelName
  private sender: WhatsAppApiSender
  private receiver: WhatsAppApiReceiver
  private logger = new Logger('wabot:whatsapp-channel')

  constructor(
    private config: WhatsappChannelConfig,
    private env: Env,
  ) {
    const accessToken = this.config.accessToken ?? this.env.requireString('WHATSAPP_ACCESS_TOKEN')
    const businessNumberId =
      this.config.businessNumberId ?? this.env.requireString('WHATSAPP_BUSINESS_NUMBER_ID')

    this.sender = new WhatsAppApiSender(accessToken, businessNumberId)
    this.receiver = new WhatsAppApiReceiver()
  }

  listen(callback: (message: IWhatsAppChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage({
      to: this.config.number,
      listener: async (message) => {
        try {
          await callback({
            channel: whatsAppChannelName,
            chatConnection: message.chatConnection,
            idempotencyKey: message.idempotencyKey,
            message: message.message,
            reply: async (replyMessage: IChatMessage) => {
              await this.sender.sendMessage({
                from: this.config.number,
                to: message.chatConnection.id,
                message: replyMessage,
              })
            },
          })
        } catch (err) {
          this.logger.error('Failed to handle WhatsApp message', err)
        }
      },
    })
  }

  connect(): void {
    this.receiver.connect()
  }

  disconnect(): void {
    this.receiver.disconnect()
  }
}
