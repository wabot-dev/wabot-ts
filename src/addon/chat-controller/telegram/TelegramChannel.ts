import { Bot } from 'grammy'

import { TelegramChannelConfig } from './TelegramChannelConfig'
import { injectable } from '@/core/injection'
import { IChannelMessage, IChatChannel } from '@/feature/chat-controller'
import { IChatConnection, IChatMessage } from '@/feature/chat-bot'

@injectable()
export class TelegramChannel implements IChatChannel {
  private bot: Bot

  constructor(private config: TelegramChannelConfig) {
    this.bot = new Bot(this.config.botToken)
  }

  listen(callback: (message: IChannelMessage) => void): void {
    this.bot.on('message', async (ctx) => {
      if (!ctx.message) {
        return
      }

      const chatConnection: IChatConnection = {
        id: ctx.message.chat.id.toString(),
        chatType: ctx.message.chat.type === 'private' ? 'PRIVATE' : 'GROUP',
        channelName: TelegramChannel.name,
      }

      callback({
        chatConnection,
        message: {
          senderName: ctx.from.first_name,
          text: ctx.message.text,
        },
        reply: (replyMessage: IChatMessage) => {
          replyMessage.text && ctx.reply(replyMessage.text)
        },
      })
    })
  }

  connect(): void {
    this.bot.start()
  }
}
