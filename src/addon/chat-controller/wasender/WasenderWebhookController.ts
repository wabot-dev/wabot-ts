import { Logger } from '@/core/logger'
import { onPost } from '@/feature/rest-controller/metadata'
import type { Wasender, WebhookRequestAdapter } from 'wasenderapi'
import type { IWasenderEvent, IWasenderMessageReceivedData } from './IWasenderEvent'
import { extractNumberFromWasenderMessageKey } from './extractNumberFromWasenderKey'
import { IncomingMessage } from 'http'
import { IWhatsAppByWasenderChatMessage } from './IWhatsAppByWasenderChatMessage'

export type IWasenderChannelMessageListener = (
  message: IWhatsAppByWasenderChatMessage,
  from: string,
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
    for (const message of messages) {
      const rawNumber = extractNumberFromWasenderMessageKey(message.key)
      const from = rawNumber.startsWith('+') ? rawNumber : `+${rawNumber}`

      this.logger.trace(`new message from '${from}'`)

      if (message.message.conversation) {
        await this.listener(
          {
            text: message.message.conversation,
            senderName: message.pushName,
            senderId: from,
            metadata: {
              whatsAppNumber: from,
            },
          },
          from,
        )
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
