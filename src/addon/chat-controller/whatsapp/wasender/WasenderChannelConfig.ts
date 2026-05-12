export class WasenderChannelConfig {
  public readonly apiKey?: string
  public readonly webhookSecret?: string
  public readonly phoneNumber?: string
  public readonly webhookPath: string
  public readonly retryOptions: { enabled: boolean; maxRetries: number }

  constructor(config: {
    apiKey?: string
    webhookSecret?: string
    phoneNumber?: string
    webhookPath?: string
  }) {
    this.apiKey = config.apiKey
    this.webhookSecret = config.webhookSecret
    this.phoneNumber = config.phoneNumber
    this.webhookPath = config.webhookPath ?? '/wasender/hook'
    this.retryOptions = { enabled: true, maxRetries: 3 }
  }
}
