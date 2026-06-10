import type { ConfigReference } from '@/core/config'

export interface IHubSpotChannelConfig {
  accessToken: string | ConfigReference<string>
  webhookSecret: string | ConfigReference<string>
  webhookPath?: string
  appId?: string
  senderActorId?: string | ConfigReference<string>
}
