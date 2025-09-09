import {
  IWhatsAppSenderOptions,
  WhatsAppSender,
  type ISendWhatsAppRequest,
} from '../WhatsAppSender'

import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { ChatRepository } from '@/feature/chat-bot'
import { ChatResolver } from '@/feature/chat-controller'

import { WhatsAppRepository } from '../WhatsAppRepository'
import { IWhatsAppProxySendMessageEventReq } from './WhatsAppProxyContracts'
import { WhatsAppWabotProxyConnection } from './WhatsAppWabotProxyConnection'

@singleton()
export class WhatsAppSenderByWabotProxy extends WhatsAppSender {
  private logger = new Logger('wabot:whatsapp-sender-by-wabot-proxy')

  constructor(
    private wabotDevConnection: WhatsAppWabotProxyConnection,
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
    const socket = await this.wabotDevConnection.getSocket()
    const req: IWhatsAppProxySendMessageEventReq = {
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
}
