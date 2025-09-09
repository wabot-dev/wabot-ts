import { IListenWhatsAppMessageRequest, WhatsAppReceiver } from '../WhatsAppReceiver'

import { injectable } from '@/core/injection'
import {
  IWhatsAppProxyListenMessageEventReq,
  IWhatsAppProxyMessageEventReq,
  WHATSAPP_MESSAGE_EVENT,
} from './WhatsAppProxyContracts'
import { WhatsAppWabotProxyConnection } from './WhatsAppWabotProxyConnection'

@injectable()
export class WhatsAppReceiverByWabotProxy extends WhatsAppReceiver {
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
      await socket.emitWithAck(req.event, req.data)

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
