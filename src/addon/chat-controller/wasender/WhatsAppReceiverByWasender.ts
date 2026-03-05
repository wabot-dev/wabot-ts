import { Logger } from '@/core/logger'
import { ExpressProvider } from '@/feature/express'
import { createWasender, type Wasender, type WebhookRequestAdapter } from 'wasenderapi'
import type { Request, Response } from 'express'
import type { IChatConnection } from '@/feature/chat-bot'
import type { IChannelMessage } from '@/feature/chat-controller'
import { extractNumberFromWasenderMessageKey } from './extractNumberFromWasenderKey'
import type { IWasenderEvent, IWasenderMessageReceivedData } from './IWasenderEvent'

export type IWasenderChannelMessageListener = (
  message: Omit<IChannelMessage, 'reply'>,
) => Promise<void>

export class WhatsAppReceiverByWasender {
  private wasender: Wasender
  private listener: IWasenderChannelMessageListener | null = null
  private logger = new Logger('wabot:whatsapp-receiver-by-wasender')

  constructor(
    private expressProvider: ExpressProvider,
    private config: {
      apiKey: string
      webhookSecret: string
      webhookPath: string
      retryOptions?: { enabled: boolean; maxRetries: number }
    },
  ) {
    this.wasender = createWasender(
      config.apiKey,
      undefined,
      undefined,
      undefined,
      config.retryOptions,
      config.webhookSecret,
    )
  }

  listenMessage(listener: IWasenderChannelMessageListener): void {
    this.listener = listener
  }

  connect(): void {
    const expressApp = this.expressProvider.getExpress()

    expressApp.post(this.config.webhookPath, async (req: Request, res: Response) => {
      try {
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

        res.sendStatus(200)
      } catch (err) {
        this.logger.error('Failed to handle Wasender webhook', err)
        res.sendStatus(500)
      }
    })

    this.expressProvider.listen()
  }

  disconnect(): void {
    // Nothing to disconnect
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

  private async parseEvent(req: Request, rawBody: string): Promise<IWasenderEvent> {
    const adapter: WebhookRequestAdapter = {
      getHeader: (name: string) => req.header(name),
      getRawBody: () => rawBody,
    }

    const event = await this.wasender.handleWebhookEvent(adapter)
    return event as unknown as IWasenderEvent
  }

  private getRawBody(req: Request): Promise<string> {
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
