import { ExpressApp, type Express } from '@/controller'
import type { IChatMessage } from '@/core'
import { inject } from '@/injection'
import { singleton } from 'tsyringe'
import type { IWhatsAppConnection, IWhatsAppMessageListener } from './IWhatsAppConnection'

@singleton()
export class WhatsAppProdConnection implements IWhatsAppConnection {
  constructor(@inject(ExpressApp) private express: Express) {
    this.express.get('/try-express', (req, res) => {
      res.status(200).json({ success: true })
    })
  }

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
