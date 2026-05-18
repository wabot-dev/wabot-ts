import { type IChatChannel } from '@/feature/chat-controller'
import type { IChatMessage } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { KapsoChannelConfig } from './KapsoChannelConfig'
import { KapsoReceiver } from './KapsoReceiver'
import { KapsoSender } from './KapsoSender'
import { IKapsoChannelMessage } from './IKapsoChannelMessage'
import { kapsoChannelName } from './KapsoChannelName'

@injectable()
export class KapsoChannel implements IChatChannel {
  private logger = new Logger('wabot:whatsapp-by-kapso-channel')
  private sender: KapsoSender
  private receiver: KapsoReceiver
  private phoneNumberId: string

  static channelName = kapsoChannelName

  constructor(config: KapsoChannelConfig, env: Env) {
    const apiKey = config.apiKey ?? env.requireString('KAPSO_API_KEY')
    const webhookSecret = config.webhookSecret ?? process.env.KAPSO_WEBHOOK_SECRET
    this.phoneNumberId = config.phoneNumberId ?? env.requireString('KAPSO_PHONE_NUMBER_ID')

    this.sender = new KapsoSender(apiKey, this.phoneNumberId)
    this.receiver = new KapsoReceiver({
      webhookSecret,
      webhookPath: config.webhookPath,
    })
  }

  listen(callback: (message: IKapsoChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage(async (message, from) => {
      try {
        await callback({
          channel: kapsoChannelName,
          chatConnection: {
            chatType: 'PRIVATE',
            channelName: KapsoChannel.channelName,
            id: from,
          },
          message,
          reply: async (replyMessage: IChatMessage) => {
            await this.sender.sendMessage({
              from: this.phoneNumberId,
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
