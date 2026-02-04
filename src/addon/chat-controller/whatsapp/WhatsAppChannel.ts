import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'

import { Logger } from '@/core/logger'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import { WhatsAppReceiver } from './WhatsAppReceiver'
import { WhatsAppSender } from './WhatsAppSender'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  private logger = new Logger('wabot:whatsapp-channel')

  constructor(
    private config: WhatsappChannelConfig,
    private sender: WhatsAppSender,
    private receiver: WhatsAppReceiver,
  ) {}

  listen(callback: (message: IChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage({
      to: this.config.number,
      listener: async (message) => {
        try {
          await callback({
            chatConnection: message.chatConnection,
            message: message.message,
            reply: async (replyMessage: IChatMessage) => {
              await this.sender.sendWhatsApp({
                from: this.config.number,
                to: message.chatConnection.id,
                message: replyMessage,
              })
            },
          })
        } catch (err) {
          this.logger.error(err)
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
