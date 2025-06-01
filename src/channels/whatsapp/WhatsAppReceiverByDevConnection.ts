import { Logger } from '@/logger'
import { WhatsAppReceiver } from './WhatsAppReceiver'

import { devListentEvent, type WabotDevConnection } from '../wabot'
import type { IWhatsAppWebhookPayload } from './IWhatsAppWebHookPayload'
import { singleton } from 'tsyringe'

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
