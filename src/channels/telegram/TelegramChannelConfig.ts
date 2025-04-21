export interface ITelegramChannelConfig {
  botToken: string
}

export class TelegramChannelConfig implements ITelegramChannelConfig{
  constructor(public botToken: string){}
}