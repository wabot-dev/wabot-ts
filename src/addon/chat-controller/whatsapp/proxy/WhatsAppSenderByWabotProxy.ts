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
    try {
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
      const ack = await socket.timeout(5000).emitWithAck(req.event, req.data)
      if (!ack || !ack.success) {
        throw new Error(
          `not success ack, when send whatsapp from '${request.from}' to '${request.to}'`,
        )
      }
      this.logger.trace(`success send whatsapp from '${request.from}' to '${request.to}'`)
      if (options?.writeChatMemory) {
        await this.writePrivateChatMemory(request.message, request.to)
      }
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp from '${request.from}' to '${request.to}'`, err)
      throw new Error(undefined, { cause: err })
    }
  }
}
