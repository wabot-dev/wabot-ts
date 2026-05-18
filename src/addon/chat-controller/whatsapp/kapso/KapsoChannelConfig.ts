export class KapsoChannelConfig {
  public readonly apiKey?: string
  public readonly webhookSecret?: string
  public readonly phoneNumberId?: string
  public readonly webhookPath: string

  constructor(config: {
    apiKey?: string
    webhookSecret?: string
    phoneNumberId?: string
    webhookPath?: string
  }) {
    this.apiKey = config.apiKey
    this.webhookSecret = config.webhookSecret
    this.phoneNumberId = config.phoneNumberId
    this.webhookPath = config.webhookPath ?? '/kapso/hook'
  }
}
