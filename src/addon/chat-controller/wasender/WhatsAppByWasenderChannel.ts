import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { WhatsAppByWasenderChannelConfig } from './WhatsAppByWasenderChannelConfig'
import { WhatsAppReceiverByWasender } from './WhatsAppReceiverByWasender'
import { WhatsAppSenderByWasender } from './WhatsAppSenderByWasender'

@injectable()
export class WhatsAppByWasenderChannel implements IChatChannel {
  private logger = new Logger('wabot:whatsapp-by-wasender-channel')
  private sender: WhatsAppSenderByWasender
  private receiver: WhatsAppReceiverByWasender
  private phoneNumber: string

  constructor(config: WhatsAppByWasenderChannelConfig, env: Env) {
    const apiKey = config.apiKey ?? env.requireString('WASENDER_API_KEY')
    const webhookSecret = config.webhookSecret ?? env.requireString('WASENDER_WEBHOOK_SECRET')
    this.phoneNumber = config.phoneNumber ?? env.requireString('WASENDER_PHONE_NUMBER')

    this.sender = new WhatsAppSenderByWasender(apiKey, config.retryOptions)
    this.receiver = new WhatsAppReceiverByWasender({
      apiKey,
      webhookSecret,
      webhookPath: config.webhookPath,
      retryOptions: config.retryOptions,
    })
  }

  listen(callback: (message: IChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage(async (message) => {
      try {
        await callback({
          chatConnection: message.chatConnection,
          message: message.message,
          reply: async (replyMessage: IChatMessage) => {
            await this.sender.send({
              from: this.phoneNumber,
              to: message.chatConnection.id,
              message: replyMessage,
            })
          },
        })
      } catch (err) {
        this.logger.error('Failed to handle WhatsApp message', err)
      }
    })
  }

  connect(): void {
    this.receiver.connect()
  }

  disconnect(): void {
    this.receiver.disconnect()
  }
}
