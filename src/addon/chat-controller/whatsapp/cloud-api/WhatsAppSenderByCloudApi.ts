import { Logger } from '@/core/logger'
import {
  IWhatsAppSenderOptions,
  WhatsAppSender,
  type IGetWhatsAppTemplateRequest,
  type ISendWhatsAppRequest,
  type ISendWhatsAppTemplateRequest,
} from '../WhatsAppSender'

import { ChatResolver } from '@/feature/chat-controller'
import { ChatRepository } from '@/feature/chat-bot'
import { singleton } from '@/core/injection'
import {
  IWhatsAppCloudTemplate,
  IWhatsAppCloudTemplateResponse,
} from './IWhatsAppCloudTemplateResponse'
import { WhatsAppRepository } from '../WhatsAppRepository'

@singleton()
export class WhatsAppSenderByCloudApi extends WhatsAppSender {
  private logger = new Logger('wabot:whatsapp-sender-by-cloud-api')

  constructor(
    chatRepository: ChatRepository,
    chatResolver: ChatResolver,
    whatsAppRepository: WhatsAppRepository,
  ) {
    super(chatRepository, chatResolver, whatsAppRepository)
  }

  override async sendWhatsApp(
    request: ISendWhatsAppRequest,
    options?: IWhatsAppSenderOptions,
  ): Promise<void> {
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

    if (options?.writeChatMemory) {
      await this.writePrivateChatMemory(request.message, request.to)
    }
  }

  async sendWhatsAppTemplate(
    request: ISendWhatsAppTemplateRequest,
    options?: IWhatsAppSenderOptions,
  ): Promise<void> {
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

    if (options?.writeChatMemory) {
      const message = await this.mapTemplateToChatMessage(request)
      await this.writePrivateChatMemory(message, request.to)
    }
  }

  protected async getWhatsAppTemplate(
    request: IGetWhatsAppTemplateRequest,
  ): Promise<IWhatsAppCloudTemplate | null> {
    const whatsApp = await this.whatsAppRepository.findByBusinessNumber(request.from)
    if (!whatsApp) {
      throw new Error(`not found WhatsApp with bussiness number '${request.from}'`)
    }

    const businessAccount = whatsApp.getBusinessAccount()

    try {
      // Make API call to WhatsApp Cloud API to get templates
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${businessAccount.id}/message_templates?name=${request.templateName}&language=${request.languageCode}&limit=1`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${whatsApp.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const data = (await response.json()) as IWhatsAppCloudTemplateResponse

      if (!response.ok) {
        throw new Error(JSON.stringify(data))
      }

      const template = data.data[0] ?? null
      return template
    } catch (error) {
      this.logger.error('Failed to fetch WhatsApp template', error)
      throw error
    }
  }
}
