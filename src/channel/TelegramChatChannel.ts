import { IChatMessage } from '@/message'
import { IChatChannel } from './IChatChannel'

import { Bot } from 'grammy'
import { IMessageContext } from './IMessageContext'
import { TelegramChannelConfig } from './TelegramChannelConfig'

export class TelegramChatChannel implements IChatChannel {
  private bot: Bot

  constructor(private config: TelegramChannelConfig) {
    this.bot = new Bot(this.config.botToken)
  }

  listen(callback: (message: IMessageContext) => void): void {
    this.bot.on('message', async (ctx) => {
      if (!ctx.message) {
        return
      }

      callback({
        chatId: '', // TODO
        origin: {
          phone: ctx.message.contact?.phone_number,
          channelType: TelegramChatChannel,
        },
        message: {
          text: ctx.message.text,
          sender: {
            shortName: ctx.from.first_name,
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
