import {
  ISendWhatsAppMessageReq,
  ISendWhatsAppTemplateReq,
  IWhatsAppSender,
} from '../IWhatsAppSender'

export class WhatsAppSender implements IWhatsAppSender {
  async sendMessage(request: ISendWhatsAppMessageReq): Promise<void> {
    throw new Error('Not implemented')
  }

  async sendTemplate(request: ISendWhatsAppTemplateReq): Promise<void> {
    throw new Error('Not implemented')
  }
}
