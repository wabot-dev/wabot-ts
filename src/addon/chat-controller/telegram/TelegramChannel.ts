import { Api, Bot, Context, InputFile } from 'grammy'
import type { Message } from 'grammy/types'

import { TelegramChannelConfig } from './TelegramChannelConfig'
import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IChatChannel } from '@/feature/chat-controller'
import {
  IChatConnection,
  IChatMessage,
  IChatMessageAudio,
  IChatMessageDocument,
  IChatMessageFile,
  IChatMessageImage,
  isChatMessageEmpty,
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

      const { images, documents, audios } = await this.extractMedia(ctx.api, ctx.message)

      // The bot (ChatBot) transcribes voice notes with the mindset's
      // speechToText model; the channel just carries the audio.
      const message: IChatMessage = {
        senderId: ctx.from.id.toString(),
        senderName: ctx.from.first_name,
        text: ctx.message.text ?? ctx.message.caption,
        images: images.length > 0 ? images : undefined,
        documents: documents.length > 0 ? documents : undefined,
        audios: audios.length > 0 ? audios : undefined,
      }

      if (isChatMessageEmpty(message)) {
        return
      }

      await callback({
        channel: telegramChannelName,
        chatConnection,
        message,
        reply: async (replyMessage: IChatMessage) => {
          if (replyMessage.text) {
            await ctx.reply(markdownToTelegramHtml(replyMessage.text), {
              parse_mode: 'HTML',
            })
          }
          const voice = replyMessage.audios?.[0]
          if (voice) await this.sendReplyAudio(ctx, voice)
        },
      })
    })
  }

  private async extractMedia(
    api: Api,
    message: Message,
  ): Promise<{
    images: IChatMessageImage[]
    documents: IChatMessageDocument[]
    audios: IChatMessageAudio[]
  }> {
    const images: IChatMessageImage[] = []
    const documents: IChatMessageDocument[] = []
    const audios: IChatMessageAudio[] = []

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

    // Voice notes and audio clips both feed the audio flow.
    const clip = message.voice ?? message.audio
    if (clip) {
      const name = message.audio?.file_name
      const file = await this.downloadChatFile(
        api,
        clip.file_id,
        clip.file_unique_id,
        clip.mime_type ?? (message.voice ? 'audio/ogg' : 'audio/mpeg'),
        name,
      )
      if (file) audios.push(file)
    }

    return { images, documents, audios }
  }

  private async sendReplyAudio(ctx: Context, audio: IChatMessageAudio): Promise<void> {
    const asVoice = audio.mimeType.includes('ogg') || audio.mimeType.includes('opus')
    const filename = audio.name ?? (asVoice ? 'reply.ogg' : 'reply.mp3')
    const input = audio.base64Url
      ? new InputFile(this.decodeBase64(audio.base64Url), filename)
      : new InputFile(new URL(audio.publicUrl!), filename)
    if (asVoice) {
      await ctx.replyWithVoice(input)
    } else {
      await ctx.replyWithAudio(input)
    }
  }

  private decodeBase64(dataUrl: string): Buffer {
    const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
    return Buffer.from(base64, 'base64')
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
