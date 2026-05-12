export interface IWasenderChannelConfig {
  apiKey?: string
  webhookSecret?: string
  phoneNumber?: string
  webhookPath?: string
  retryOptions?: {
    enabled: boolean
    maxRetries: number
  }
}
