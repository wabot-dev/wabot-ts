import { ChatItem, type ChatRepository, type IChatMessage } from '@/core'
import type { IWhatsAppTemplateMessage } from './IWhatsAppTemplateMessage'
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

    return {
      text: template.components
        .filter((x) => x.text != null)
        .map((x) => x.text)
        .join('\n'),
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
}
