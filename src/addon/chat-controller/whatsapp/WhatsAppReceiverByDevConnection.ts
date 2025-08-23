import { Logger } from '@/core/logger'
import { WhatsAppReceiver } from './WhatsAppReceiver'


import { singleton } from 'tsyringe'
import type { IWhatsAppWebhookPayload } from './IWhatsAppWebHookPayload'
import { WabotDevConnection } from './WabotDevConnection'
import { devListentEvent } from './WabotDevSocketContracts'

@singleton()
export class WhatsAppReceiverByDevConnection extends WhatsAppReceiver {
  constructor(private wabotDevConnection: WabotDevConnection) {
    super(new Logger('wabot:whatsapp-receiver-by-dev-connection'))
  }

  async connect() {
    const socket = await this.wabotDevConnection.getSocket()

    socket.on(devListentEvent.DEV_WATSAPP_WEBHOOK, (payload: IWhatsAppWebhookPayload) => {
      this.handlePayload(payload)
    })
  }
}
