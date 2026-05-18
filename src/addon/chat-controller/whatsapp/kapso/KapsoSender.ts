import { Logger } from '@/core/logger'
import {
  ISendWhatsAppMessageReq,
  ISendWhatsAppTemplateReq,
  IWhatsAppSender,
} from '../IWhatsAppSender'

export class KapsoSender implements IWhatsAppSender {
  private logger = new Logger('wabot:whatsapp-sender-by-kapso')
  private baseUrl = 'https://api.kapso.ai/meta/whatsapp/v24.0'

  constructor(
    private apiKey: string,
    private phoneNumberId: string,
  ) {}

  async sendMessage(request: ISendWhatsAppMessageReq): Promise<void> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to.replace(/\D+/g, ''),
      type: 'text',
      text: {
        preview_url: false,
        body: request.message.text ?? '',
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      this.logger.error(
        `Failed to send message from '${request.from}' to '${request.to}': ${response.status} ${errorBody}`,
      )
      throw new Error(`Kapso send message failed: ${response.status} ${errorBody}`)
    }

    this.logger.trace(`message sent from '${request.from}' to '${request.to}'`)
  }

  async sendTemplate(_request: ISendWhatsAppTemplateReq): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
