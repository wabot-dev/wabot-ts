import { createHmac, timingSafeEqual } from 'node:crypto'
import { IncomingMessage } from 'node:http'
import { Logger } from '@/core/logger'
import { onPost } from '@/feature/rest-controller/metadata'
import type { IKapsoEvent, IKapsoMessageReceivedEvent } from './IKapsoEvent'
import { IKapsoChatMessage } from './IKapsoChatMessage'

export type IKapsoChannelMessageListener = (
  message: IKapsoChatMessage,
  from: string,
) => Promise<void>

export class KapsoWebhookController {
  private logger = new Logger('wabot:kapso-webhook')

  constructor(
    private webhookSecret: string | undefined,
    private listener: IKapsoChannelMessageListener,
  ) {}

  @onPost({ disableJsonParser: true, disableUrlEncodedParser: true })
  async handleWebhook(req: IncomingMessage) {
    const rawBody = await this.getRawBody(req)

    if (!this.verifySignature(req, rawBody)) {
      this.logger.warn('rejected webhook with invalid signature')
      throw new Error('Invalid webhook signature')
    }

    let event: IKapsoEvent
    try {
      event = JSON.parse(rawBody) as IKapsoEvent
    } catch (err) {
      this.logger.error('Failed to parse webhook payload', err)
      throw new Error('Invalid webhook payload')
    }

    this.logger.trace(`received event ${event.event}`)

    switch (event.event) {
      case 'whatsapp.message.received':
        await this.handleMessageReceived(event as IKapsoMessageReceivedEvent)
        break
      default:
        this.logger.trace(`unhandled event type ${event.event}`)
    }
  }

  private async handleMessageReceived(event: IKapsoMessageReceivedEvent): Promise<void> {
    const message = event.message
    if (message.type !== 'text' || !message.text) {
      this.logger.warn(`message type '${message.type}' is not supported yet`)
      return
    }

    const rawNumber = message.from ?? event.conversation?.phone_number ?? ''
    if (!rawNumber) {
      this.logger.warn('received message without a sender number')
      return
    }
    const from = rawNumber.startsWith('+') ? rawNumber : `+${rawNumber}`
    const senderName = event.conversation?.kapso?.contact_name ?? message.username ?? from

    this.logger.trace(`new message from '${from}'`)

    await this.listener(
      {
        text: message.text.body,
        senderName,
        senderId: from,
        metadata: {
          whatsAppNumber: from,
        },
      },
      from,
    )
  }

  private verifySignature(req: IncomingMessage, rawBody: string): boolean {
    if (!this.webhookSecret) {
      return true
    }
    const headerValue = req.headers['x-webhook-signature']
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue
    if (!provided) {
      return false
    }
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')
    const providedHex = provided.startsWith('sha256=') ? provided.slice('sha256='.length) : provided
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(providedHex, 'hex')
    if (expectedBuf.length !== providedBuf.length) {
      return false
    }
    return timingSafeEqual(expectedBuf, providedBuf)
  }

  private getRawBody(req: IncomingMessage): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => {
        data += chunk
      })
      req.on('end', () => resolve(data))
      req.on('error', (err) => reject(err))
    })
  }
}
