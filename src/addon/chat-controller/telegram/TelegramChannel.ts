import { Bot } from 'grammy'

import { TelegramChannelConfig } from './TelegramChannelConfig'
import { injectable } from '@/core/injection'
import { IChatChannel } from '@/feature/chat-controller'
import { IChatConnection, IChatMessage } from '@/feature/chat-bot'
import { ITelegramChannelMessage } from './ITelegramChannelMessage'
import { markdownToTelegramHtml } from './markdownToTelegramHtml'
import { telegramChannelName } from './telegramChannelName'

@injectable()
export class TelegramChannel implements IChatChannel {
  static channelName = telegramChannelName

  private bot: Bot

  constructor(private config: TelegramChannelConfig) {
    this.bot = new Bot(this.config.botToken)
  }

  listen(callback: (message: ITelegramChannelMessage) => Promise<void>): void {
    this.bot.on('message', async (ctx) => {
      if (!ctx.message) {
        return
      }

      const chatConnection: IChatConnection = {
        id: ctx.message.chat.id.toString(),
        chatType: ctx.message.chat.type === 'private' ? 'PRIVATE' : 'GROUP',
        channelName: TelegramChannel.channelName,
      }

      await callback({
        channel: telegramChannelName,
        chatConnection,
        message: {
          senderId: ctx.from.id.toString(),
          senderName: ctx.from.first_name,
          text: ctx.message.text,
        },
        reply: async (replyMessage: IChatMessage) => {
          if (!replyMessage.text) return
          await ctx.reply(markdownToTelegramHtml(replyMessage.text), {
            parse_mode: 'HTML',
          })
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
