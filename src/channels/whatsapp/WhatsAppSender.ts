import { ChatItem, type ChatRepository, type IChatMessage } from '@/core'
import type { IWhatsAppTemplateMessage } from './IWhatsAppTemplateMessage'
import type { Logger } from '@/logger'
import type { ChatResolver } from '@/controller'
import type { WhatsAppRepository } from './WhatsAppRepository'

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

  abstract handleSendRequest(request: ISendWhatsAppRequest): Promise<void>
  abstract handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<void>
  abstract handleGetWhatsAppTemplate(request: IGetWhatsAppTemplateRequest): Promise<string>

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
    const success = this.handleSendTemplateRequest(request)
    if (!success) {
      return
    }
    if (options?.writeChatMemory) {
      const message = await this.resolveTemplateToChatMessage(request)
      await this.writePrivateChatMemory(message, request.to)
    }
  }

  protected async resolveTemplateToChatMessage(
    request: ISendWhatsAppTemplateRequest,
  ): Promise<IChatMessage> {
    const text = await this.handleGetWhatsAppTemplate({
      from: request.from,
      templateName: request.templateMessage.templateName,
      languageCode: request.templateMessage.languageCode,
    })

    return {
      text,
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
