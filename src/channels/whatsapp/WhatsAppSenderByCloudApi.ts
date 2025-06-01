import { WhatsAppSender, type ISendWhatsAppRequest, type ISendWhatsAppTemplateRequest } from "./WhatsAppSender";

export class WhatsAppSenderByCloudApi extends WhatsAppSender {

  handleSendRequest(request: ISendWhatsAppRequest): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  handleSendTemplateRequest(request: ISendWhatsAppTemplateRequest): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  handleGetWhatsAppTemplate(templateName: string, languageCode: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
}
