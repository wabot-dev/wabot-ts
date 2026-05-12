import {
  ISendWhatsAppMessageReq,
  ISendWhatsAppTemplateReq,
  IWhatsAppSender,
} from '../IWhatsAppSender'
import { singleton } from '@/core/injection'
import { Env } from '@/core/env'

@singleton()
export class WhatsAppApiSender implements IWhatsAppSender {
  private accessToken: string
  private businessNumberId: string

  constructor(env: Env) {
    this.accessToken = env.requireString('WHATSAPP_ACCESS_TOKEN')
    this.businessNumberId = env.requireString('WHATSAPP_BUSINESS_NUMBER_ID')
  }

  async sendMessage(request: ISendWhatsAppMessageReq): Promise<void> {
    const url = `https://graph.facebook.com/v23.0/${this.businessNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to,
      type: 'text',
      text: {
        preview_url: false,
        body: request.message.text ?? '',
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(JSON.stringify(data))
    }
  }

  async sendTemplate(request: ISendWhatsAppTemplateReq): Promise<void> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to,
      type: 'template',
      template: {
        name: request.templateData.templateName,
        language: {
          code: request.templateData.languageCode,
        },
        components: [
          {
            type: 'body',
            parameters: request.templateData.parameters,
          },
        ],
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${this.businessNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(JSON.stringify(data))
    }
  }
}
