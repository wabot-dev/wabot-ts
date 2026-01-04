import { IListenWhatsAppMessageRequest, WhatsAppReceiver } from '../WhatsAppReceiver'

import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import {
  IWhatsAppProxyListenMessageEventReq,
  IWhatsAppProxyMessageEventReq,
  WHATSAPP_MESSAGE_EVENT,
} from './WhatsAppProxyContracts'
import { WhatsAppWabotProxyConnection } from './WhatsAppWabotProxyConnection'

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
          to: request.to,
        },
      }
      const response = await socket.emitWithAck(req.event, req.data)
      if (response && typeof response == 'object' && response['error']) {
        this.loger.error(response.error)
        return
      } else if (
        !response ||
        typeof response !== 'object' ||
        !Array.isArray(response.from) ||
        typeof response.to !== 'string'
      ) {
        this.loger.error('unknown response')
        return
      }

      this.loger.trace(
        `succes add whats-app proxy listener for messages from [${response.from.join(',')}] to [${response.to.join(',')}]`,
      )

      socket.on(WHATSAPP_MESSAGE_EVENT, (data: IWhatsAppProxyMessageEventReq['data'], callback) => {
        if (data.to !== request.to) {
          throw new Error(`expecting message to '${request.to}' but received to='${data.to}'`)
        }
        callback({ success: true })

        this.loger.trace(`success receive message from '${data.from}' to '${data.to}'`)
        request.listener({
          chatConnection: {
            chatType: 'PRIVATE',
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
