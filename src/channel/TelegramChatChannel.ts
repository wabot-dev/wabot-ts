import { IChatMessage } from '@/message'
import { IChatChannel } from './IChatChannel'

import { Bot } from 'grammy'
import { ChatResolver } from './ChatResolver'
import { IMessageContext, IMessageOrigin } from './IMessageContext'
import { TelegramChannelConfig } from './TelegramChannelConfig'
import { injectable } from '@/injection'

@injectable()
export class TelegramChatChannel implements IChatChannel {
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

      const origin: IMessageOrigin = {
        chatId: ctx.message.chat.id.toString(),
        chatType: ctx.message.chat.type === 'private' ? 'PRIVATE' : 'GROUP',
        channelType: TelegramChatChannel,
      }

      const chat = await this.chatResolver.resolve(origin)

      callback({
        chatId: chat.getId(),
        origin,
        message: {
          text: ctx.message.text,
          sender: {
            shortName: ctx.from.first_name,
            senderId: ctx.from.id != null ? ctx.from.id.toString() : undefined,
          },
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
