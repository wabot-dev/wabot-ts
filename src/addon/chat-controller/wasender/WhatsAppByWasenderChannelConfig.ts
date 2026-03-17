import { type IWhatsAppByWasenderChannelConfig } from './IWhatsAppByWasenderChannelConfig'

export class WhatsAppByWasenderChannelConfig implements IWhatsAppByWasenderChannelConfig {
  public readonly apiKey?: string
  public readonly webhookSecret?: string
  public readonly phoneNumber?: string
  public readonly webhookPath: string
  public readonly retryOptions: { enabled: boolean; maxRetries: number }

  constructor(config: IWhatsAppByWasenderChannelConfig) {
    this.apiKey = config.apiKey
    this.webhookSecret = config.webhookSecret
    this.phoneNumber = config.phoneNumber
    this.webhookPath = config.webhookPath ?? '/wasender/hook'
    this.retryOptions = config.retryOptions ?? { enabled: true, maxRetries: 3 }
  }
}
