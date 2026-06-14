import {
  AttachmentBuilder,
  Client,
  Events,
  GatewayIntentBits,
  Message,
  StickerFormatType,
} from 'discord.js'

import { injectable } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import {
  IChatConnection,
  IChatMessage,
  IChatMessageDocument,
  IChatMessageFile,
  IChatMessageImage,
} from '@/feature/chat-bot'
import { IChatChannel } from '@/feature/chat-controller'
import { DiscordChannelConfig } from './DiscordChannelConfig'
import { IDiscordChannelMessage } from './IDiscordChannelMessage'
import { IDiscordEmbed } from './IDiscordEmbed'
import { IDiscordOutbound } from './IDiscordOutbound'
import { DISCORD_MESSAGE_CONTEXT, IDiscordMessageContext } from './IDiscordMessageContext'
import { discordChannelName } from './discordChannelName'

const TEXT_LIMIT = 2000
const EMBED_LIMIT = 10
const EMBED_DESCRIPTION_LIMIT = 4096
const EMBED_FIELDS_LIMIT = 25
const EMBED_FIELD_VALUE_LIMIT = 1024
const EMBED_FIELD_NAME_LIMIT = 256
const EMBED_TOTAL_LIMIT = 6000
const STICKER_LIMIT = 3

const DEFAULT_INTENTS: GatewayIntentBits[] = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
]

@injectable()
export class DiscordChannel implements IChatChannel {
  static channelName = discordChannelName

  private client: Client
  private callback: ((message: IDiscordChannelMessage) => Promise<void>) | null = null
  private logger = new Logger('wabot:discord-channel')
  private botToken: string
  private botUserId: string = ''

  constructor(
    private config: DiscordChannelConfig,
    env?: Env,
  ) {
    this.botToken = config.botToken || env?.requireString('DISCORD_TOKEN') || ''
    if (!this.botToken) {
      throw new Error('DiscordChannel: botToken not provided and DISCORD_TOKEN env var is not set')
    }
    this.client = new Client({
      intents: config.intents ?? DEFAULT_INTENTS,
    })
  }

  listen(callback: (message: IDiscordChannelMessage) => Promise<void>): void {
    this.callback = callback
    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.id !== this.botUserId) {
        this.logger.debug(
          `MessageCreate event: from ${message.author.username} [${message.guild ? 'GUILD' : 'DM'}] in #${message.channel.id}`,
        )
      }
      void this.handleMessage(message)
    })
  }

  connect(): void {
    if (!this.effectiveIntents().includes(GatewayIntentBits.MessageContent)) {
      throw new Error(
        'DiscordChannel: MESSAGE_CONTENT intent is not enabled. ' +
          'Enable the privileged Message Content Intent in the Discord Developer Portal ' +
          'and pass GatewayIntentBits.MessageContent via DiscordChannelConfig.intents.',
      )
    }
    const intentNames = this.effectiveIntents()
      .map((i) => GatewayIntentBits[i])
      .join(', ')
    this.logger.info(`connecting to discord gateway with intents: ${intentNames}`)
    this.client.on(Events.ClientReady, (c) => {
      this.botUserId = c.user.id
      this.logger.info(`logged in as ${c.user.tag} (id=${this.botUserId})`)
    })
    this.client.on(Events.Error, (err) => {
      this.logger.error('discord client error', err)
    })
    this.client.login(this.botToken).catch((err) => {
      this.logger.error('discord login failed', err)
    })
  }

  disconnect(): void {
    this.callback = null
    void this.client.destroy()
  }

  private effectiveIntents(): GatewayIntentBits[] {
    return this.config.intents ?? DEFAULT_INTENTS
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!this.callback) {
      this.logger.warn(`received message but no callback registered`)
      return
    }
    if (message.author.id === this.botUserId) {
      this.logger.debug(`ignored self-message in #${message.channel.id}`)
      return
    }

    this.logger.info(
      `received from ${message.author.username} [${message.guild ? 'GUILD' : 'DM'}] in #${message.channel.id}: "${message.content.slice(0, 200)}"`,
    )

    const chatConnection: IChatConnection = {
      id: message.channel.id,
      chatType: message.guild ? 'GROUP' : 'PRIVATE',
      channelName: discordChannelName,
    }

    const extracted = await this.extractMedia(message)

    const discordCtx: IDiscordMessageContext = {
      botUserId: this.botUserId,
      wasBotMentioned:
        !!message.guild && this.botUserId.length > 0 && message.mentions.has(this.botUserId),
      wasEveryoneMentioned: !!message.guild && message.mentions.everyone,
      isDirectMessage: !message.guild,
    }
    try {
      await this.callback({
        channel: discordChannelName,
        chatConnection,
        message: {
          senderId: message.author.id,
          senderName: message.author.username,
          text: extracted.text,
          images: extracted.images.length > 0 ? extracted.images : undefined,
          documents: extracted.documents.length > 0 ? extracted.documents : undefined,
          object: extracted.embeds.length > 0 ? { embeds: extracted.embeds } : undefined,
          metadata: Object.keys(extracted.metadata).length > 0 ? extracted.metadata : undefined,
        },
        reply: async (replyMessage: IChatMessage) => this.sendReply(message, replyMessage),
        extras: { discord: discordCtx },
        injectInstances: [[DISCORD_MESSAGE_CONTEXT, discordCtx]],
      })
      this.logger.info(`callback completed for ${message.author.username}`)
    } catch (err) {
      this.logger.error(
        `callback failed for ${message.author.username} in #${message.channel.id}`,
        err,
      )
    }
  }

  private async extractMedia(message: Message): Promise<{
    text: string | undefined
    images: IChatMessageImage[]
    documents: IChatMessageDocument[]
    embeds: IDiscordEmbed[]
    metadata: Record<string, string>
  }> {
    const images: IChatMessageImage[] = []
    const documents: IChatMessageDocument[] = []
    const embeds: IDiscordEmbed[] = []
    const metadata: Record<string, string> = {}

    for (const [, attachment] of message.attachments) {
      const file = await this.downloadAttachment(
        attachment.id,
        attachment.url,
        attachment.contentType ?? 'application/octet-stream',
        attachment.name ?? undefined,
      )
      if (!file) continue
      if ((attachment.contentType ?? '').startsWith('image/')) {
        images.push(file)
      } else {
        documents.push(file)
      }
    }

    for (const [, sticker] of message.stickers) {
      if (sticker.format === StickerFormatType.PNG || sticker.format === StickerFormatType.APNG) {
        const file = await this.downloadSticker(sticker.id, sticker.name, sticker.url)
        if (file) {
          file.name = `sticker:${sticker.name}`
          images.push(file)
        }
      } else {
        this.logger.warn(
          `skipping unsupported discord sticker '${sticker.name}' (format=${sticker.format})`,
        )
      }
    }

    if (message.embeds.length > 0) {
      embeds.push(...message.embeds.map((e) => e.toJSON() as IDiscordEmbed))
      const first = message.embeds[0]
      if (first.title) metadata.embedTitle = first.title
      if (first.url) metadata.embedUrl = first.url
      if (first.description) {
        metadata.embedDescription = first.description.slice(0, 256)
      }
    }

    return {
      text: message.content || undefined,
      images,
      documents,
      embeds,
      metadata,
    }
  }

  private async downloadAttachment(
    id: string,
    url: string,
    mimeType: string,
    name: string | undefined,
  ): Promise<IChatMessageFile | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      return { id, name, mimeType, base64Url: `data:${mimeType};base64,${base64}` }
    } catch (err) {
      this.logger.warn(
        `failed to download discord attachment '${id}'`,
        err instanceof Error ? { message: err.message } : { err },
      )
      return null
    }
  }

  private async downloadSticker(
    id: string,
    name: string,
    url: string,
  ): Promise<IChatMessageImage | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      return {
        id,
        name,
        mimeType: 'image/png',
        base64Url: `data:image/png;base64,${base64}`,
      }
    } catch (err) {
      this.logger.warn(
        `failed to download discord sticker '${id}'`,
        err instanceof Error ? { message: err.message } : { err },
      )
      return null
    }
  }

  private async sendToChannel(
    channel: Message['channel'],
    options: {
      content?: string
      embeds?: IDiscordEmbed[]
      stickers?: string[]
      files?: AttachmentBuilder[]
    },
  ): Promise<void> {
    const target = channel as unknown as {
      send: (options: unknown) => Promise<unknown>
    }
    await target.send(options)
  }

  private async sendReply(originalMessage: Message, message: IChatMessage): Promise<void> {
    const text = this.truncateText(message.text ?? '')
    const outbound = this.readOutbound(message.object)
    const embeds = this.enforceEmbedLimits(outbound.embeds ?? [])
    const stickerIds = (outbound.stickerIds ?? []).slice(0, STICKER_LIMIT)
    const files = await this.buildFiles(message)

    if (!text && embeds.length === 0 && stickerIds.length === 0 && files.length === 0) {
      this.logger.debug('skipping empty reply')
      return
    }

    const options: {
      content?: string
      embeds?: IDiscordEmbed[]
      stickers?: string[]
      files?: AttachmentBuilder[]
    } = {}
    if (text) options.content = text
    if (embeds.length > 0) options.embeds = embeds
    if (stickerIds.length > 0) options.stickers = stickerIds
    if (files.length > 0) options.files = files

    try {
      await this.sendToChannel(originalMessage.channel, options)
      this.logger.info(
        `sent reply to ${originalMessage.author.username} in #${originalMessage.channel.id} (${text.length} chars, ${embeds.length} embeds, ${files.length} files)`,
      )
    } catch (err) {
      this.logger.error(
        `failed to send reply to ${originalMessage.author.username} in #${originalMessage.channel.id}`,
        err,
      )
      throw err
    }
  }

  private readOutbound(object: object | undefined): IDiscordOutbound {
    if (!object || typeof object !== 'object') return {}
    const candidate = object as Partial<IDiscordOutbound>
    const result: IDiscordOutbound = {}
    if (Array.isArray(candidate.embeds)) result.embeds = candidate.embeds
    if (Array.isArray(candidate.stickerIds)) result.stickerIds = candidate.stickerIds
    return result
  }

  private async buildFiles(message: IChatMessage): Promise<AttachmentBuilder[]> {
    const files: AttachmentBuilder[] = []
    for (const image of message.images ?? []) {
      const buf = await this.toBuffer(image)
      if (!buf) continue
      files.push(new AttachmentBuilder(buf, { name: image.name ?? 'image' }))
    }
    for (const doc of message.documents ?? []) {
      const buf = await this.toBuffer(doc)
      if (!buf) continue
      files.push(new AttachmentBuilder(buf, { name: doc.name ?? 'document' }))
    }
    return files
  }

  private async toBuffer(file: IChatMessageFile): Promise<Buffer | null> {
    if (file.base64Url) {
      const match = file.base64Url.match(/^data:[^;]+;base64,(.+)$/)
      if (match) return Buffer.from(match[1], 'base64')
      return null
    }
    if (file.publicUrl) {
      try {
        const res = await fetch(file.publicUrl)
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
      } catch {
        return null
      }
    }
    return null
  }

  private truncateText(text: string): string {
    if (text.length <= TEXT_LIMIT) return text
    const head = text.slice(0, TEXT_LIMIT - 1)
    const lastSpace = head.lastIndexOf(' ')
    const lastNewline = head.lastIndexOf('\n')
    const cutAt = Math.max(lastSpace, lastNewline)
    const base = cutAt > TEXT_LIMIT * 0.5 ? head.slice(0, cutAt) : head
    return base.replace(/[\s.,;:!?]+$/, '') + '…'
  }

  private enforceEmbedLimits(embeds: IDiscordEmbed[]): IDiscordEmbed[] {
    return embeds.slice(0, EMBED_LIMIT).map((embed) => this.truncateEmbed(embed))
  }

  private truncateEmbed(embed: IDiscordEmbed): IDiscordEmbed {
    const truncated: IDiscordEmbed = {
      title: this.truncate(embed.title ?? '', EMBED_FIELD_NAME_LIMIT),
      description: this.truncate(embed.description ?? '', EMBED_DESCRIPTION_LIMIT),
      url: embed.url,
      timestamp: embed.timestamp,
      color: embed.color,
      footer: embed.footer,
      image: embed.image,
      thumbnail: embed.thumbnail,
      author: embed.author,
      fields: (embed.fields ?? []).slice(0, EMBED_FIELDS_LIMIT).map((field) => ({
        name: this.truncate(field.name ?? '', EMBED_FIELD_NAME_LIMIT),
        value: this.truncate(field.value ?? '', EMBED_FIELD_VALUE_LIMIT),
        inline: field.inline,
      })),
    }
    if (this.embedTotalLength(truncated) <= EMBED_TOTAL_LIMIT) return truncated

    if (truncated.description) {
      const budget = Math.max(0, EMBED_TOTAL_LIMIT - this.nonDescriptionLength(truncated))
      truncated.description = this.truncate(truncated.description, budget)
    }

    if (this.embedTotalLength(truncated) > EMBED_TOTAL_LIMIT) {
      const overflow = this.embedTotalLength(truncated) - EMBED_TOTAL_LIMIT
      truncated.fields = this.dropFieldsForOverflow(truncated.fields ?? [], overflow)
    }

    return truncated
  }

  private nonDescriptionLength(embed: IDiscordEmbed): number {
    let total = 0
    if (embed.title) total += embed.title.length
    for (const field of embed.fields ?? []) {
      total += (field.name?.length ?? 0) + (field.value?.length ?? 0)
    }
    if (embed.footer?.text) total += embed.footer.text.length
    if (embed.author?.name) total += embed.author.name.length
    return total
  }

  private dropFieldsForOverflow(
    fields: IDiscordEmbed['fields'],
    overflow: number,
  ): IDiscordEmbed['fields'] {
    if (overflow <= 0 || !fields || fields.length === 0) return fields
    const removed = fields[fields.length - 1]
    const removedSize = (removed.name?.length ?? 0) + (removed.value?.length ?? 0)
    const next = fields.slice(0, -1)
    if (removedSize >= overflow || next.length === 0) return next
    return this.dropFieldsForOverflow(next, overflow - removedSize)
  }

  private embedTotalLength(embed: IDiscordEmbed): number {
    let total = 0
    if (embed.title) total += embed.title.length
    if (embed.description) total += embed.description.length
    for (const field of embed.fields ?? []) {
      total += (field.name?.length ?? 0) + (field.value?.length ?? 0)
    }
    if (embed.footer?.text) total += embed.footer.text.length
    if (embed.author?.name) total += embed.author.name.length
    return total
  }

  private truncate(text: string, limit: number): string {
    if (!text || text.length <= limit) return text
    return text.slice(0, Math.max(0, limit - 1)) + '…'
  }
}
