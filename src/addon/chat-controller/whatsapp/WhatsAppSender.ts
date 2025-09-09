import { ChatItem, type ChatRepository, type IChatMessage } from '@/feature/chat-bot'
import type { ChatResolver } from '@/feature/chat-controller'
import type {
  IWhatsAppCloudTemplateMessage,
  IWhatsAppCloudTemplateParameter,
} from './cloud-api/IWhatsAppCloudTemplateMessage'
import { IWhatsAppCloudTemplate } from './cloud-api/IWhatsAppCloudTemplateResponse'
import type { WhatsAppRepository } from './WhatsAppRepository'

export interface ISendWhatsAppRequest {
  from: string
  to: string
  message: IChatMessage
}

export interface ISendWhatsAppTemplateRequest {
  from: string
  to: string
  templateMessage: IWhatsAppCloudTemplateMessage
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

export class WhatsAppSender {
  constructor(
    protected chatRepository: ChatRepository,
    protected chatResolver: ChatResolver,
    protected whatsAppRepository: WhatsAppRepository,
  ) {}

  async sendWhatsApp(
    request: ISendWhatsAppRequest,
    options?: IWhatsAppSenderOptions,
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  async sendWhatsAppTemplate(
    request: ISendWhatsAppTemplateRequest,
    options?: IWhatsAppSenderOptions,
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  protected getWhatsAppTemplate(
    request: IGetWhatsAppTemplateRequest,
  ): Promise<IWhatsAppCloudTemplate | null> {
    throw new Error('Not implemented')
  }

  protected async mapTemplateToChatMessage(
    request: ISendWhatsAppTemplateRequest,
  ): Promise<IChatMessage> {
    const template = await this.getWhatsAppTemplate({
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

    const chatMemory = await this.chatRepository.findMemory(chat.id)

    const chatItem = new ChatItem({
      type: 'botMessage',
      botMessage: message,
    })

    await chatMemory!.create(chatItem)
  }

  protected replaceTemplateParameters(
    template: string,
    data: IWhatsAppCloudTemplateParameter[],
  ): string {
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
