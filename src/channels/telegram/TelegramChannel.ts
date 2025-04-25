import { type IChatMessage } from '@/core/message'

import { ChatResolver, type IChatChannel } from '@/controller'
import { Bot } from 'grammy'

import type { IChatConnection, IMessageContext, IUserConnection } from '@/core'
import { injectable } from '@/injection'
import { TelegramChannelConfig } from './TelegramChannelConfig'

@injectable()
export class TelegramChannel implements IChatChannel {
  private bot: Bot

  constructor(
    private config: TelegramChannelConfig,
    private chatResolver: ChatResolver,
  ) {
    this.bot = new Bot(this.config.botToken)
  }

  listen(callback: (message: IMessageContext) => void): void {
    this.bot.on('message', async (ctx) => {
      if (!ctx.message) {
        return
      }

      const chatConnection: IChatConnection = {
        id: ctx.message.chat.id.toString(),
        chatType: ctx.message.chat.type === 'private' ? 'PRIVATE' : 'GROUP',
        channelName: TelegramChannel.name,
      }

      const chat = await this.chatResolver.resolve(chatConnection)

      const userConnection: IUserConnection = {
        id: ctx.from.id.toString(),
        channelName: TelegramChannel.name,
      }

      callback({
        chat,
        message: {
          chatConnection,
          userConnection,
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
