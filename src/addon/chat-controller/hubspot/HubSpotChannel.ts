import { injectable } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { IChatChannel } from '@/feature/chat-controller'
import { IChatMessage, IChatConnection } from '@/feature/chat-bot'

import { hubspotChannelName } from './hubspotChannelName'
import { HubSpotChannelConfig } from './HubSpotChannelConfig'
import { HubSpotSender } from './HubSpotSender'
import { HubSpotReceiver } from './HubSpotReceiver'
import { IHubSpotChannelMessage } from './IHubSpotChannelMessage'
import { IHubSpotMessagePayload } from './IHubSpotMessagePayload'
import { markdownToHubSpotHtml } from './markdownToHubSpotHtml'

@injectable()
export class HubSpotChannel implements IChatChannel {
  static channelName = hubspotChannelName

  private logger = new Logger(`wabot:hubspot-channel`)
  private sender: HubSpotSender
  private receiver: HubSpotReceiver
  private accessToken: string
  private webhookSecret: string
  private appId: string | undefined

  constructor(config: HubSpotChannelConfig, env: Env) {
    this.accessToken = config.accessToken ?? env.requireString('HUBSPOT_ACCESS_TOKEN')
    this.webhookSecret = config.webhookSecret ?? env.requireString('HUBSPOT_WEBHOOK_SECRET')
    this.appId = config.appId

    const resolvedConfig = new HubSpotChannelConfig({
      accessToken: this.accessToken,
      webhookSecret: this.webhookSecret,
      webhookPath: config.webhookPath,
      appId: this.appId,
      senderActorId: config.senderActorId ?? process.env.HUBSPOT_SENDER_ACTOR_ID,
    })

    this.sender = new HubSpotSender(resolvedConfig)
    this.receiver = new HubSpotReceiver(resolvedConfig)
  }

  listen(callback: (message: IHubSpotChannelMessage) => Promise<void>): void {
    this.receiver.listenMessage(async (payload) => {
      await callback(this.toChannelMessage(payload, callback))
    })
  }

  connect(): void {
    this.receiver.connect()
  }

  disconnect(): void {
    this.receiver.disconnect()
  }

  private toChannelMessage(
    payload: IHubSpotMessagePayload,
    callback: (message: IHubSpotChannelMessage) => Promise<void>,
  ): IHubSpotChannelMessage {
    const chatConnection: IChatConnection = {
      id: payload.threadId,
      chatType: 'PRIVATE',
      channelName: HubSpotChannel.channelName,
    }
    return {
      channel: hubspotChannelName,
      chatConnection,
      message: {
        senderId: payload.senderId,
        senderName: payload.senderName,
        text: payload.text,
        images: payload.files.length > 0 ? (payload.files as any) : undefined,
        metadata: payload.metadata,
      },
      reply: async (replyMessage: IChatMessage) => {
        const text = replyMessage.text
        await this.sender.sendMessage({
          threadId: payload.threadId,
          text,
          richText: text ? markdownToHubSpotHtml(text) : undefined,
          files: [
            ...(replyMessage.images ?? []),
            ...(replyMessage.documents ?? []),
          ],
          channelId: payload.channelId,
          channelAccountId: payload.channelAccountId,
        })
        // Mark callback so the reference is captured (avoids linter complaints if unused).
        void callback
      },
    }
  }
}
