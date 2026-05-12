import { type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { WasenderChannelConfig } from './WasenderChannelConfig'
import { WasenderReceiver } from './WasenderReceiver'
import { WasenderSender } from './WasenderSender'
import { IWasenderChannelMessage } from './IWasenderChannelMessage'
import { wasenderChannelName } from './WasenderChannelName'

@injectable()
export class WasenderChannel implements IChatChannel {
  private logger = new Logger('wabot:whatsapp-by-wasender-channel')
  private sender: WasenderSender
  private receiver: WasenderReceiver
  private phoneNumber: string

  static channelName = wasenderChannelName

  constructor(config: WasenderChannelConfig, env: Env) {
    const apiKey = config.apiKey ?? env.requireString('WASENDER_API_KEY')
    const webhookSecret = config.webhookSecret ?? env.requireString('WASENDER_WEBHOOK_SECRET')
    this.phoneNumber = config.phoneNumber ?? env.requireString('WASENDER_PHONE_NUMBER')

    this.sender = new WasenderSender(apiKey, config.retryOptions)
    this.receiver = new WasenderReceiver({
      apiKey,
      webhookSecret,
      webhookPath: config.webhookPath,
      retryOptions: config.retryOptions,
    })
  }

  listen(callback: (message: IWasenderChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage(async (message, from) => {
      try {
        await callback({
          channel: wasenderChannelName,
          chatConnection: {
            chatType: 'PRIVATE',
            channelName: WasenderChannel.channelName,
            id: from,
          },
          message,
          reply: async (replyMessage: IChatMessage) => {
            await this.sender.sendMessage({
              from: this.phoneNumber,
              to: from,
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
