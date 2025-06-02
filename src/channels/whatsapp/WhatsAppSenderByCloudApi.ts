import { Logger } from '@/logger'
import {
  WhatsAppSender,
  type IGetWhatsAppTemplateRequest,
  type ISendWhatsAppRequest,
  type ISendWhatsAppTemplateRequest,
} from './WhatsAppSender'

import type { ChatRepository } from '@/core'
import type { ChatResolver } from '@/controller'
import type { WhatsAppRepository } from './WhatsAppRepository'

export class WhatsAppSenderByCloudApi extends WhatsAppSender {
  constructor(
    chatRepository: ChatRepository,
    chatResolver: ChatResolver,
    whatsAppRepository: WhatsAppRepository,
  ) {
    super(
      new Logger('wabot:whatsapp-sender-by-cloud-api'),
      chatRepository,
      chatResolver,
      whatsAppRepository,
    )
  }

  async handleSendRequest(request: ISendWhatsAppRequest): Promise<void> {
    const whatsApp = await this.whatsAppRepository.findByBusinessNumber(request.from)
    if (!whatsApp) {
      throw new Error(`not found WhatsApp with bussiness number '${request.from}'`)
    }

    const businessNumber = whatsApp.getBussinessNumber(request.from)!
    const url = `https://graph.facebook.com/v23.0/${businessNumber.id}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to,
      type: 'text',
      text: {
        preview_url: false,
        body: request.message.text,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsApp.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(JSON.stringify(data))
    }
  }

  async handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<void> {
    const whatsApp = await this.whatsAppRepository.findByBusinessNumber(request.from)
    if (!whatsApp) {
      throw new Error(`not found WhatsApp with bussiness number '${request.from}'`)
    }

    const businessNumber = whatsApp.getBussinessNumber(request.from)!

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to,
      type: 'template',
      template: {
        name: request.templateMessage.templateName,
        language: {
          code: request.templateMessage.languageCode,
        },
        components: [
          {
            type: 'body',
            parameters: request.templateMessage.parameters,
          },
        ],
      },
    }

    const response = await fetch(`https://graph.facebook.com/v23.0/${businessNumber.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsApp.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(JSON.stringify(data))
    }
  }

  async handleGetWhatsAppTemplate(request: IGetWhatsAppTemplateRequest): Promise<string> {
    const whatsApp = await this.whatsAppRepository.findByBusinessNumber(request.from)
    if (!whatsApp) {
      throw new Error(`not found WhatsApp with bussiness number '${request.from}'`)
    }

    const businessNumber = whatsApp.getBussinessNumber(request.from)!

    try {
      // Get WhatsApp Business Account ID from environment variable
      const whatsappBusinessId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
      if (!whatsappBusinessId) {
        throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID environment variable is not set')
      }

      // Make API call to WhatsApp Cloud API to get templates
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${businessNumber.id}/message_templates?name=${request.templateName}&language=${request.languageCode}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${whatsApp.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Find the template with matching language
      const template = data.data?.find(
        (t: any) =>
          t.name === request.templateName &&
          t.language?.toLowerCase() === request.languageCode.toLowerCase(),
      )

      if (!template) {
        throw new Error(
          `Template ${request.templateName} not found for language ${request.languageCode}`,
        )
      }

      // Return the template components joined together
      return template.components
        .filter((c: any) => c.type === 'BODY')
        .map((c: any) => c.text)
        .join('\n')
    } catch (error) {
      console.error('Failed to get WhatsApp template:', error)
      throw error
    }
  }
}
