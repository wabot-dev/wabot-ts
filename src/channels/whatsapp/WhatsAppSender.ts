import { ChatItem, type ChatRepository, type IChatMessage } from '@/core'
import type {
  IWhatsAppTemplateMessage,
  IWhatsAppTemplateParameter,
} from './IWhatsAppTemplateMessage'
import type { Logger } from '@/logger'
import type { ChatResolver } from '@/controller'
import type { WhatsAppRepository } from './WhatsAppRepository'
import { IWhatsAppTemplate } from './IWhatsAppTemplateResponse'

export interface ISendWhatsAppRequest {
  from: string
  to: string
  message: IChatMessage
}

export interface ISendWhatsAppTemplateRequest {
  from: string
  to: string
  templateMessage: IWhatsAppTemplateMessage
  senderName: string
}

export interface IGetWhatsAppTemplateRequest {
  from: string
  templateName: string
  languageCode: string
}

export interface IWhatsAppSenderOptions {
  writeChatMemory?: boolean
}

export abstract class WhatsAppSender {
  constructor(
    protected logger: Logger,
    protected chatRepository: ChatRepository,
    protected chatResolver: ChatResolver,
    protected whatsAppRepository: WhatsAppRepository,
  ) {}

  protected abstract handleSendRequest(request: ISendWhatsAppRequest): Promise<void>
  protected abstract handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<void>
  protected abstract handleGetWhatsAppTemplate(
    request: IGetWhatsAppTemplateRequest,
  ): Promise<IWhatsAppTemplate | null>

  async sendWhatsApp(
    request: ISendWhatsAppRequest,
    options?: IWhatsAppSenderOptions,
  ): Promise<void> {
    try {
      await this.handleSendRequest(request)
      if (options?.writeChatMemory) {
        await this.writePrivateChatMemory(request.message, request.to)
      }
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error}`)
      throw new Error(`Error sending WhatsApp message: ${error}`, { cause: error })
    }
  }

  async sendWhatsAppTemplate(
    request: ISendWhatsAppTemplateRequest,
    options?: IWhatsAppSenderOptions,
  ): Promise<void> {
    try {
      await this.handleSendTemplateRequest(request)
      if (options?.writeChatMemory) {
        const message = await this.resolveTemplateToChatMessage(request)
        await this.writePrivateChatMemory(message, request.to)
      }
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error}`)
      throw new Error(`Error sending WhatsApp message: ${error}`, { cause: error })
    }
  }

  async getWhatsAppTemplate(
    request: IGetWhatsAppTemplateRequest,
  ): Promise<IWhatsAppTemplate | null> {
    try {
      const template = await this.handleGetWhatsAppTemplate(request)
      return template
    } catch (error) {
      this.logger.error(error)
      throw new Error('Error getting WhatsApp template:', { cause: error })
    }
  }

  protected async resolveTemplateToChatMessage(
    request: ISendWhatsAppTemplateRequest,
  ): Promise<IChatMessage> {
    const template = await this.handleGetWhatsAppTemplate({
      from: request.from,
      templateName: request.templateMessage.templateName,
      languageCode: request.templateMessage.languageCode,
    })
    if (!template) {
      throw new Error(
        `WhatsAppTemplate with name ${request.templateMessage.templateName} and language ${request.templateMessage.languageCode} not found`,
      )
    }
    const components = template.components
      .filter((x) => x.text != null)
      .map((x) => x.text)
      .join('\n')

    return {
      text: this.replaceTemplateParameters(components, request.templateMessage.parameters),
      senderName: request.senderName,
    }
  }

  protected async writePrivateChatMemory(message: IChatMessage, to: string): Promise<void> {
    const chatConnection = {
      id: to,
      chatType: 'PRIVATE',
      channelName: 'WhatsAppChannel',
    } as const

    const chat = await this.chatResolver.resolve(chatConnection)

    const chatMemory = await this.chatRepository.findMemory(chat.getId())!

    const chatItem = new ChatItem({
      type: 'BOT_MESSAGE',
      content: message,
    })

    await chatMemory!.create(chatItem)
  }

  private replaceTemplateParameters(template: string, data: IWhatsAppTemplateParameter[]): string {
    let result = template

    data.forEach((param) => {
      if (param.type === 'text' && param.parameter_name) {
        const tag = `{{${param.parameter_name}}}`
        result = result.split(tag).join(param.text)
      }
    })

    data.forEach((param, index) => {
      if (param.type === 'text') {
        const tag = `{{${index + 1}}}`
        result = result.split(tag).join(param.text)
      }
    })

    return result
  }
}
