import Bolt from '@slack/bolt'

const { App } = Bolt

import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { type IChatChannel } from '@/feature/chat-controller'
import { type IChatConnection, type IChatMessage } from '@/feature/chat-bot'

import { ISlackChannelMessage } from './ISlackChannelMessage'
import { SlackChannelConfig } from './SlackChannelConfig'
import { markdownToSlackMrkdwn } from './markdownToSlackMrkdwn'
import { slackChannelName } from './slackChannelName'

const GROUP_CHANNEL_TYPES = new Set(['channel', 'group', 'mpim'])
const PRIVATE_CHANNEL_TYPES = new Set(['im'])

interface SlackMessage {
  channel: string
  channel_type?: string
  user?: string
  text?: string
  subtype?: string
  thread_ts?: string
  files?: Array<{ id: string; name?: string; mimetype?: string; url_private?: string }>
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

    const channelType = message.channel_type
    const chatType: IChatConnection['chatType'] = GROUP_CHANNEL_TYPES.has(channelType ?? '')
      ? 'GROUP'
      : PRIVATE_CHANNEL_TYPES.has(channelType ?? '')
        ? 'PRIVATE'
        : 'GROUP'

    const chatConnection: IChatConnection = {
      id: message.channel,
      chatType,
      channelName: SlackChannel.channelName,
    }

    const senderName = await this.resolveUserName(message.user)
    const text = message.text ?? ''

    const reply: ISlackChannelMessage['reply'] = async (replyMessage: IChatMessage) => {
      if (!replyMessage.text) return
      await say({
        text: markdownToSlackMrkdwn(replyMessage.text),
        mrkdwn: true,
      })
    }

    try {
      await this.callback({
        channel: slackChannelName,
        chatConnection,
        message: {
          senderId: message.user,
          senderName,
          text,
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
