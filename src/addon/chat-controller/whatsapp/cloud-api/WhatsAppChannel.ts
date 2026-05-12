import { type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'

import { Logger } from '@/core/logger'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import { WhatsAppReceiver } from './WhatsAppReceiver'
import { WhatsAppSender } from './WhatsAppSender'
import { IWhatsAppChannelMessage } from './IWhatsAppChannelMessage'
import { whatsAppChannelName } from './whatsAppChannelName'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  static channelName = whatsAppChannelName
  private sender: WhatsAppSender
  private receiver: WhatsAppReceiver

  private logger = new Logger('wabot:whatsapp-channel')

  constructor(private config: WhatsappChannelConfig) {
    this.sender = new WhatsAppSender()
    this.receiver = new WhatsAppReceiver()
  }

  listen(callback: (message: IWhatsAppChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage({
      to: this.config.number,
      listener: async (message) => {
        try {
          await callback({
            channel: whatsAppChannelName,
            chatConnection: message.chatConnection,
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
