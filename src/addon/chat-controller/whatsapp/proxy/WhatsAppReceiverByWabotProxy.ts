import { IListenWhatsAppMessageRequest, WhatsAppReceiver } from '../WhatsAppReceiver'

import { injectable } from '@/core/injection'
import {
  IWhatsAppProxyListenMessageEventReq,
  IWhatsAppProxyMessageEventReq,
  WHATSAPP_MESSAGE_EVENT,
} from './WhatsAppProxyContracts'
import { WhatsAppWabotProxyConnection } from './WhatsAppWabotProxyConnection'
import { CustomError } from '@/core/error'
import { Logger } from '@/core/logger'

@injectable()
export class WhatsAppReceiverByWabotProxy extends WhatsAppReceiver {
  private loger = new Logger('wabot:whats-app-receiver-by-wabot-proxy')

  constructor(private connection: WhatsAppWabotProxyConnection) {
    super()
  }

  async connect(): Promise<void> {
    // Nothing
  }

  listenMessage(request: IListenWhatsAppMessageRequest): void {
    this.connection.getSocket().then(async (socket) => {
      const req: IWhatsAppProxyListenMessageEventReq = {
        event: 'listenMessage',
        data: {
          to: [request.to],
        },
      }
      const response = await socket.emitWithAck(req.event, req.data)
      if (response && typeof response == 'object' && response['error']) {
        this.loger.error(response.error)
        return
      } else if (
        response &&
        typeof response == 'object' &&
        Array.isArray(response.from) &&
        Array.isArray(response.to)
      ) {
        this.loger.trace(
          `succes add whats-app proxy listener for messages from [${response.from.join(',')}] to [${response.to.join(',')}]`,
        )
      } else {
        this.loger.error('unknown response')
        return
      }

      socket.on(WHATSAPP_MESSAGE_EVENT, (data: IWhatsAppProxyMessageEventReq['data']) => {
        if (data.to !== request.to) {
          throw new Error(`expecting message to '${request.to}' but received to='${data.to}'`)
        }
        request.listener({
          chatConnection: {
            channelName: 'WhatsAppChannel',
            id: data.from,
          },
          message: {
            text: data.content.text,
            senderName: data.senderName,
            senderId: data.from,
          },
        })
      })
    })
  }
}
