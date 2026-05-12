import { Logger } from '@/core/logger'
import { createWasender, TextOnlyMessage, type Wasender } from 'wasenderapi'
import {
  ISendWhatsAppMessageReq,
  ISendWhatsAppTemplateReq,
  IWhatsAppSender,
} from '../IWhatsAppSender'

export class WasenderSender implements IWhatsAppSender {
  private wasender: Wasender
  private logger = new Logger('wabot:whatsapp-sender-by-wasender')

  constructor(apiKey: string, retryOptions?: { enabled: boolean; maxRetries: number }) {
    this.wasender = createWasender(apiKey, undefined, undefined, undefined, retryOptions, undefined)
  }

  async sendMessage(request: ISendWhatsAppMessageReq): Promise<void> {
    try {
      const textPayload: TextOnlyMessage = {
        messageType: 'text',
        to: `+${request.to.replace(/\D+/g, '')}`,
        text: request.message.text ?? 'No Text',
      }
      const result = await this.wasender.send(textPayload)
      this.logger.trace(`message sent from '${request.from}' to '${request.to}'`)
      this.logger.trace(`rate limit remaining: ${result.rateLimit?.remaining}`)
    } catch (error) {
      this.logger.error(`Failed to send message from '${request.from}' to '${request.to}'`, error)
      if (error instanceof Error) {
        throw new Error(error.message, { cause: error })
      } else {
        throw new Error('error sending message')
      }
    }
  }

  sendTemplate(request: ISendWhatsAppTemplateReq): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
