import { Logger } from '@/logger'
import { WhatsAppReceiver } from './WhatsAppReceiver'

import { devListentEvent, WabotDevConnection } from '../wabot'
import type { IWhatsAppWebhookPayload } from './IWhatsAppWebHookPayload'
import { singleton } from 'tsyringe'
import { container } from '@/injection'

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

if (WabotDevConnection.isTokenAvailable()) {
  container.register(WhatsAppReceiver as any, {
    useClass: WhatsAppReceiverByDevConnection,
  })
}
