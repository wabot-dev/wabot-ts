export interface IWhatsappChannelConfig {
  number: string
  accessToken?: string
  businessNumberId?: string
  proxy?: string
}

export class WhatsappChannelConfig implements IWhatsappChannelConfig {
  constructor(
    public number: string,
    public accessToken?: string,
    public businessNumberId?: string,
  ) {}
}
