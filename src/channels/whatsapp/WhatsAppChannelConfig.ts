export interface IWhatsappChannelConfig {
  number: string
  proxy?: string
}

export class WhatsappChannelConfig implements IWhatsappChannelConfig {
  constructor(public number: string) {}
}
