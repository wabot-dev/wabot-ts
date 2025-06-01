import {
  WhatsAppSender,
  type ISendWhatsAppRequest,
  type ISendWhatsAppTemplateRequest,
} from './WhatsAppSender'

import {
  devEmitEvent,
  type IDevSendWhatsappRequest,
  type IDevSendWhatsappTemplateRequest,
  type WabotDevConnection,
} from '../wabot'
import { Logger } from '@/logger'
import type { ChatRepository } from '@/core'
import { singleton } from '@/injection'
import type { ChatResolver } from '@/controller'

@singleton()
export class WhatsAppSenderByDevConnection extends WhatsAppSender {
  constructor(
    private wabotDevConnection: WabotDevConnection,
    chatRepository: ChatRepository,
    chatResolver: ChatResolver,
  ) {
    super(new Logger('wabot:whatsapp-sender-by-dev-connection'), chatRepository, chatResolver)
  }

  async handleSendRequest(request: ISendWhatsAppRequest): Promise<boolean> {
    const socket = await this.wabotDevConnection.getSocket()
    const req: IDevSendWhatsappRequest = {
      from: request.from,
      to: request.to,
      message: request.message,
    }
    const ack = await socket.emitWithAck(devEmitEvent.DEV_SEND_WHATSAPP, req)
    if (ack != 'OK') {
      this.logger.debug(ack)
      return false
    }
    return true
  }

  async handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<boolean> {
    const socket = await this.wabotDevConnection.getSocket()
    const req: IDevSendWhatsappTemplateRequest = {
      from: request.from,
      to: request.to,
      message: request.templateMessage,
    }
    const ack = await socket.emitWithAck(devEmitEvent.DEV_SEND_WHATSAPP_TEMPLATE, req)
    if (ack != 'OK') {
      this.logger.debug(ack)
      return false
    }
    return true
  }

  handleGetWhatsAppTemplate(templateName: string, languageCode: string): Promise<string> {
    throw new Error('Method not implemented.')
  }
}
