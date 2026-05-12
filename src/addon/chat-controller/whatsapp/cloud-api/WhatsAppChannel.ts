import { type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable, inject } from '@/core/injection'

import { Logger } from '@/core/logger'
import { Env } from '@/core/env'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import { WhatsAppReceiver } from './WhatsAppReceiver'
import { WhatsAppApiSender } from './WhatsAppApiSender'
import { IWhatsAppChannelMessage } from './IWhatsAppChannelMessage'
import { whatsAppChannelName } from './whatsAppChannelName'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  static channelName = whatsAppChannelName
  private sender: WhatsAppApiSender
  private receiver: WhatsAppReceiver

  private logger = new Logger('wabot:whatsapp-channel')

  constructor(
    private config: WhatsappChannelConfig,
    @inject(Env) private env: Env,
  ) {
    this.sender = new WhatsAppApiSender(env)
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
