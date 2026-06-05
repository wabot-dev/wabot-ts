import { Api, Bot } from 'grammy'
import type { Message } from 'grammy/types'

import { TelegramChannelConfig } from './TelegramChannelConfig'
import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IChatChannel } from '@/feature/chat-controller'
import {
  IChatConnection,
  IChatMessage,
  IChatMessageDocument,
  IChatMessageFile,
  IChatMessageImage,
} from '@/feature/chat-bot'
import { ITelegramChannelMessage } from './ITelegramChannelMessage'
import { markdownToTelegramHtml } from './markdownToTelegramHtml'
import { telegramChannelName } from './telegramChannelName'

@injectable()
export class TelegramChannel implements IChatChannel {
  static channelName = telegramChannelName

  private bot: Bot
  private logger = new Logger('wabot:telegram-channel')

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

      const { images, documents } = await this.extractMedia(ctx.api, ctx.message)

      await callback({
        channel: telegramChannelName,
        chatConnection,
        message: {
          senderId: ctx.from.id.toString(),
          senderName: ctx.from.first_name,
          text: ctx.message.text ?? ctx.message.caption,
          images: images.length > 0 ? images : undefined,
          documents: documents.length > 0 ? documents : undefined,
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

  private async extractMedia(
    api: Api,
    message: Message,
  ): Promise<{ images: IChatMessageImage[]; documents: IChatMessageDocument[] }> {
    const images: IChatMessageImage[] = []
    const documents: IChatMessageDocument[] = []

    if (message.photo && message.photo.length > 0) {
      // Photos arrive in multiple sizes; the last entry is the highest resolution.
      const largest = message.photo[message.photo.length - 1]
      const file = await this.downloadChatFile(
        api,
        largest.file_id,
        largest.file_unique_id,
        'image/jpeg',
      )
      if (file) images.push(file)
    }

    if (message.document) {
      const doc = message.document
      const mimeType = doc.mime_type ?? 'application/octet-stream'
      const file = await this.downloadChatFile(
        api,
        doc.file_id,
        doc.file_unique_id,
        mimeType,
        doc.file_name,
      )
      // An image sent as an uncompressed file still belongs with the images.
      if (file) (mimeType.startsWith('image/') ? images : documents).push(file)
    }

    return { images, documents }
  }

  private async downloadChatFile(
    api: Api,
    fileId: string,
    id: string,
    mimeType: string,
    name?: string,
  ): Promise<IChatMessageFile | null> {
    try {
      const file = await api.getFile(fileId)
      if (!file.file_path) return null
      const url = `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      return { id, name, mimeType, base64Url: `data:${mimeType};base64,${base64}` }
    } catch (err) {
      this.logger.warn(
        `failed to download telegram file '${id}'`,
        err instanceof Error ? { message: err.message } : { err },
      )
      return null
    }
  }

  connect(): void {
    this.bot.start()
  }

  disconnect(): void {
    this.bot.stop()
  }
}
