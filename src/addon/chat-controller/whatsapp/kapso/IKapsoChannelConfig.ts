import type { ConfigReference } from '@/core/config'

export interface IKapsoChannelConfig {
  apiKey?: string | ConfigReference<string>
  webhookSecret?: string | ConfigReference<string>
  phoneNumberId?: string | ConfigReference<string>
  webhookPath?: string
}
