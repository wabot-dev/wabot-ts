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

  listen(callback: (message: IChannelMessage) => Promise<void>): void {
    this.bot.on('message', async (ctx) => {
      if (!ctx.message) {
        return
      }

      const chatConnection: IChatConnection = {
        id: ctx.message.chat.id.toString(),
        chatType: ctx.message.chat.type === 'private' ? 'PRIVATE' : 'GROUP',
        channelName: TelegramChannel.name,
      }

      await callback({
        chatConnection,
        message: {
          senderName: ctx.from.first_name,
          text: ctx.message.text,
        },
        reply: async (replyMessage: IChatMessage) => {
          if (!replyMessage.text) return
          await ctx.reply(replyMessage.text)
        },
      })
    })
  }

  connect(): void {
    this.bot.start()
  }

  disconnect(): void {
    this.bot.stop()
  }
}
