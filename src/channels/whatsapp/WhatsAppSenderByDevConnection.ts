import {
  WhatsAppSender,
  type IGetWhatsAppTemplateRequest,
  type ISendWhatsAppRequest,
  type ISendWhatsAppTemplateRequest,
} from './WhatsAppSender'

import {
  devEmitEvent,
  WabotDevConnection,
  type IDevSendWhatsappRequest,
  type IDevSendWhatsappTemplateRequest,
} from '../wabot'
import { Logger } from '@/logger'
import { ChatRepository } from '@/core'
import { container, singleton } from '@/injection'
import { ChatResolver } from '@/controller'
import { WhatsAppRepository } from './WhatsAppRepository'
import { IWhatsAppTemplate } from './IWhatsAppTemplateResponse'

@singleton()
export class WhatsAppSenderByDevConnection extends WhatsAppSender {
  constructor(
    private wabotDevConnection: WabotDevConnection,
    chatRepository: ChatRepository,
    chatResolver: ChatResolver,
    whatsAppRepository: WhatsAppRepository,
  ) {
    super(
      new Logger('wabot:whatsapp-sender-by-dev-connection'),
      chatRepository,
      chatResolver,
      whatsAppRepository,
    )
  }

  async handleSendRequest(request: ISendWhatsAppRequest): Promise<void> {
    const socket = await this.wabotDevConnection.getSocket()
    const req: IDevSendWhatsappRequest = {
      from: request.from,
      to: request.to,
      message: request.message,
    }
    const ack = await socket.emitWithAck(devEmitEvent.DEV_SEND_WHATSAPP, req)
    if (ack != 'OK') {
      throw new Error(`Error sending WhatsApp template: ${ack}`)
    }
  }

  async handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<void> {
    const socket = await this.wabotDevConnection.getSocket()
    const req: IDevSendWhatsappTemplateRequest = {
      from: request.from,
      to: request.to,
      message: request.templateMessage,
    }
    const ack = await socket.emitWithAck(devEmitEvent.DEV_SEND_WHATSAPP_TEMPLATE, req)
    if (ack != 'OK') {
      throw new Error(`Error sending WhatsApp template: ${ack}`)
    }
  }

  async handleGetWhatsAppTemplate(request: IGetWhatsAppTemplateRequest): Promise<IWhatsAppTemplate | null>{
    throw new Error("Not implemented")
  }
}

if (WabotDevConnection.isTokenAvailable()) {
  container.register(WhatsAppSender as any, {
    useClass: WhatsAppSenderByDevConnection,
  })
}
