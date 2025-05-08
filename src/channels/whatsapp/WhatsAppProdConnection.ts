import { singleton } from 'tsyringe'
import type { IWhatsAppConnection, IWhatsAppMessageListener } from './IWhatsAppConnection'
import type { IChatMessage } from '@/core'

@singleton()
export class WhatsAppProdConnection implements IWhatsAppConnection {
  listenMessage(businessNumber: string, listener: IWhatsAppMessageListener): void {
    throw new Error('Method not implemented.')
  }
  sendWhatsApp(businessNumber: string, to: string, replyMessage: IChatMessage): Promise<void> {
    throw new Error('Method not implemented.')
  }
  connect(): void {
    throw new Error('Method not implemented.')
  }
}
