import { singleton } from 'tsyringe'
import type { IWhatsAppConnection } from './IWhatsAppConnection'
import type { WabotEnv } from '@/env'
import type { WhatsAppDevConnection } from './WhatsAppDevConnection'
import type { WhatsAppProdConnection } from './WhatsAppProdConnection'
import type { IChatMessage } from '@/core'
import type { IWhatsAppTemplateMessage } from './IWhatsAppTemplateMessage'

@singleton()
export class WhatsAppSender {
  private whatsAppConection: IWhatsAppConnection

  constructor(
    private wabotEnv: WabotEnv,
    devConnection: WhatsAppDevConnection,
    prodConnection: WhatsAppProdConnection,
  ) {
    this.whatsAppConection = this.wabotEnv.isProduction() ? prodConnection : devConnection
  }

  async send(businessNumber: string, to: string, message: IChatMessage): Promise<void> {
    this.whatsAppConection.sendWhatsApp(businessNumber, to, message)
  }

  async sendTemplate(
    businessNumber: string,
    to: string,
    templateMessage: IWhatsAppTemplateMessage,
  ): Promise<void> {
    this.whatsAppConection.sendWhatsAppTemplate(businessNumber, to, templateMessage)
  }
}
