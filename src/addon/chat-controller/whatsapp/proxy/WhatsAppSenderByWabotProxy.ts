import {
  WhatsAppSender,
  type IGetWhatsAppTemplateRequest,
  type ISendWhatsAppRequest,
  type ISendWhatsAppTemplateRequest,
} from '../WhatsAppSender'

import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { ChatRepository } from '@/feature/chat-bot'
import { ChatResolver } from '@/feature/chat-controller'

import { IWhatsAppCloudTemplate } from '../cloud-api/IWhatsAppCloudTemplateResponse'
import { IWhatsAppSendMessageEventReq } from './WhatsAppProxyContracts'
import { WhatsAppRepository } from '../WhatsAppRepository'
import { WhatsAppWabotProxyConnection } from './WhatsAppWabotProxyConnection'

@singleton()
export class WhatsAppSenderByWabotProxy extends WhatsAppSender {
  constructor(
    private wabotDevConnection: WhatsAppWabotProxyConnection,
    chatRepository: ChatRepository,
    chatResolver: ChatResolver,
    whatsAppRepository: WhatsAppRepository,
  ) {
    super(
      new Logger('wabot:whatsapp-sender-by-wabot-proxy'),
      chatRepository,
      chatResolver,
      whatsAppRepository,
    )
  }

  async handleSendRequest(request: ISendWhatsAppRequest): Promise<void> {
    const socket = await this.wabotDevConnection.getSocket()
    const req: IWhatsAppSendMessageEventReq = {
      event: 'sendMessage',
      data: {
        from: request.from,
        to: request.to,
        content: {
          text: request.message.text ?? 'No Text',
        },
      },
    }
    await socket.emitWithAck(req.event, req.data)
  }

  async handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<void> {
    throw new Error('Not implemented')
  }

  async handleGetWhatsAppTemplate(
    request: IGetWhatsAppTemplateRequest,
  ): Promise<IWhatsAppCloudTemplate | null> {
    throw new Error('Not implemented')
  }
}
