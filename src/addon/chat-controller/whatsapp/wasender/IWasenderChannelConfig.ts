import type { ConfigReference } from '@/core/config'

export interface IWasenderChannelConfig {
  apiKey?: string | ConfigReference<string>
  webhookSecret?: string | ConfigReference<string>
  phoneNumber?: string | ConfigReference<string>
  webhookPath?: string
}
