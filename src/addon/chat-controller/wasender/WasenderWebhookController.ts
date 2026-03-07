import { Logger } from '@/core/logger'
import { onPost } from '@/feature/rest-controller/metadata'
import type { Wasender, WebhookRequestAdapter } from 'wasenderapi'
import type { IChatConnection } from '@/feature/chat-bot'
import type { IChannelMessage } from '@/feature/chat-controller'
import type { IWasenderEvent, IWasenderMessageReceivedData } from './IWasenderEvent'
import { extractNumberFromWasenderMessageKey } from './extractNumberFromWasenderKey'
import { IncomingMessage } from 'http'

export type IWasenderChannelMessageListener = (
  message: Omit<IChannelMessage, 'reply'>,
) => Promise<void>

export class WasenderWebhookController {
  private logger = new Logger('wabot:wasender-webhook')

  constructor(
    private wasender: Wasender,
    private listener: IWasenderChannelMessageListener,
  ) {}

  @onPost({ disableJsonParser: true, disableUrlEncodedParser: true })
  async handleWebhook(req: IncomingMessage) {
    const rawBody = await this.getRawBody(req)
    const event = await this.parseEvent(req, rawBody)
    this.logger.trace(`received event ${event.event}`)

    switch (event.event) {
      case 'messages.received':
        const messages = Array.isArray(event.data.messages)
          ? event.data.messages
          : [event.data.messages]
        await this.handleMessages(messages)
        break
      default:
        this.logger.warn(`unhandled event type ${event.event}`)
    }
  }

  private async handleMessages(messages: IWasenderMessageReceivedData[]): Promise<void> {
    if (!this.listener) {
      this.logger.warn('No listener registered, ignoring messages')
      return
    }

    for (const message of messages) {
      const from = extractNumberFromWasenderMessageKey(message.key)

      this.logger.trace(`new message from '${from}'`)

      if (message.message.conversation) {
        const chatConnection: IChatConnection = {
          chatType: 'PRIVATE',
          channelName: 'WhatsAppByWasenderChannel',
          id: from,
        }

        await this.listener({
          chatConnection,
          message: {
            text: message.message.conversation,
            senderName: message.pushName,
            senderId: from,
          },
        })
      }
    }
  }

  private async parseEvent(req: IncomingMessage, rawBody: string): Promise<IWasenderEvent> {
    const adapter: WebhookRequestAdapter = {
      getHeader: (name: string) => {
        const value = req.headers[name.toLowerCase()]
        return Array.isArray(value) ? value[0] : value
      },
      getRawBody: () => rawBody,
    }

    const event = await this.wasender.handleWebhookEvent(adapter)
    return event as unknown as IWasenderEvent
  }

  private getRawBody(req: IncomingMessage): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let data = ''

      req.on('data', (chunk) => {
        data += chunk
      })

      req.on('end', () => {
        resolve(data)
      })

      req.on('error', (err) => {
        reject(err)
      })
    })
  }
}
