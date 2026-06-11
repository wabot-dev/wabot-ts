import Bolt from '@slack/bolt'

const { App } = Bolt

import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { type IChatChannel } from '@/feature/chat-controller'
import {
  type IChatConnection,
  type IChatMessage,
  type IChatMessageDocument,
  type IChatMessageFile,
  type IChatMessageImage,
} from '@/feature/chat-bot'

import { ISlackChannelMessage } from './ISlackChannelMessage'
import { SlackChannelConfig } from './SlackChannelConfig'
import { markdownToSlackMrkdwn } from './markdownToSlackMrkdwn'
import { slackChannelName } from './slackChannelName'

const GROUP_CHANNEL_TYPES = new Set(['channel', 'group', 'mpim'])
const PRIVATE_CHANNEL_TYPES = new Set(['im'])
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

interface SlackFile {
  id: string
  name?: string
  mimetype?: string
  url_private?: string
  size?: number
}

interface SlackMessage {
  channel: string
  channel_type?: string
  user?: string
  text?: string
  ts?: string
  subtype?: string
  thread_ts?: string
  files?: SlackFile[]
}

interface SlackSay {
  (args: { text: string; mrkdwn?: boolean; thread_ts?: string }): Promise<unknown>
}

@injectable()
export class SlackChannel implements IChatChannel {
  static channelName = slackChannelName

  private app: InstanceType<typeof App>
  private callback: ((message: ISlackChannelMessage) => Promise<void>) | null = null
  private logger = new Logger('wabot:slack-channel')

  constructor(private config: SlackChannelConfig) {
    this.app = new App({
      token: config.botToken,
      appToken: config.appToken,
      socketMode: true,
      signingSecret: config.signingSecret,
      deferInitialization: true,
    })
  }

  listen(callback: (message: ISlackChannelMessage) => Promise<void>): void {
    this.callback = callback

    this.app.message(async (args: unknown) => {
      await this.handleMessage(args as { message: SlackMessage; say: SlackSay })
    })
  }

  private async handleMessage(args: { message: SlackMessage; say: SlackSay }): Promise<void> {
    if (!this.callback) return
    const { message, say } = args

    if (message.subtype && message.subtype !== 'file_share') {
      return
    }

    const chatConnection = this.buildChatConnection(message)
    const threadTs = message.thread_ts ?? message.ts
    const { images, documents } = await this.extractMedia(message.files)

    const senderName = await this.resolveUserName(message.user)
    const text = message.text ?? ''

    const reply = this.buildReply(say, threadTs)

    try {
      await this.callback({
        channel: slackChannelName,
        chatConnection,
        message: {
          senderId: message.user,
          senderName,
          text,
          images: images.length > 0 ? images : undefined,
          documents: documents.length > 0 ? documents : undefined,
        },
        reply,
      })
    } catch (err) {
      this.logger.error(
        'Failed to handle Slack message',
        err instanceof Error ? { message: err.message } : { err },
      )
    }
  }

  private buildChatConnection(message: SlackMessage): IChatConnection {
    const channelType = message.channel_type
    const chatType: IChatConnection['chatType'] = GROUP_CHANNEL_TYPES.has(channelType ?? '')
      ? 'GROUP'
      : PRIVATE_CHANNEL_TYPES.has(channelType ?? '')
        ? 'PRIVATE'
        : 'GROUP'

    return {
      id: message.channel,
      chatType,
      channelName: SlackChannel.channelName,
    }
  }

  private buildReply(say: SlackSay, threadTs: string | undefined) {
    return async (replyMessage: IChatMessage): Promise<void> => {
      if (!replyMessage.text) return
      await say({
        text: markdownToSlackMrkdwn(replyMessage.text),
        mrkdwn: true,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      })
    }
  }

  private async extractMedia(
    files: SlackFile[] | undefined,
  ): Promise<{ images: IChatMessageImage[]; documents: IChatMessageDocument[] }> {
    const images: IChatMessageImage[] = []
    const documents: IChatMessageDocument[] = []
    if (!files || files.length === 0) return { images, documents }

    const results = await Promise.all(files.map((file) => this.downloadFile(file)))
    for (const result of results) {
      if (!result) continue
      if (result.file.mimeType.startsWith('image/')) {
        images.push(result.file)
      } else {
        documents.push(result.file)
      }
    }
    return { images, documents }
  }

  private async downloadFile(file: SlackFile): Promise<{ file: IChatMessageFile } | null> {
    const mimeType = file.mimetype ?? 'application/octet-stream'
    if (!file.url_private) {
      this.logger.warn(`slack file '${file.id}' has no url_private, skipping`)
      return null
    }
    if (file.size !== undefined && file.size > MAX_FILE_SIZE_BYTES) {
      this.logger.warn(`slack file '${file.id}' exceeds 20 MB (${file.size} bytes), skipping`)
      return null
    }
    try {
      const res = await fetch(file.url_private, {
        headers: { Authorization: `Bearer ${this.config.botToken}` },
      })
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`)
      }
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      return {
        file: {
          id: file.id,
          name: file.name,
          mimeType,
          base64Url: `data:${mimeType};base64,${base64}`,
        },
      }
    } catch (err) {
      this.logger.warn(
        `failed to download slack file '${file.id}'`,
        err instanceof Error ? { message: err.message } : { err },
      )
      return null
    }
  }

  private async resolveUserName(userId: string | undefined): Promise<string | undefined> {
    if (!userId) return undefined
    try {
      const res = await this.app.client.users.info({ user: userId })
      const user = (res as { ok?: boolean; user?: { real_name?: string; name?: string } }).user
      if (user) {
        return user.real_name || user.name || userId
      }
    } catch (err) {
      this.logger.warn(
        `failed to resolve slack user '${userId}'`,
        err instanceof Error ? { message: err.message } : { err },
      )
    }
    return userId
  }

  connect(): void {
    void (async () => {
      await this.app.init()
      await this.app.start()
    })()
  }

  disconnect(): void {
    void this.app.stop()
  }
}
