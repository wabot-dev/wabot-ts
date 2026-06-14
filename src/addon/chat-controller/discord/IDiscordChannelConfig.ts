import type { ConfigReference } from '@/core/config'
import type { GatewayIntentBits } from 'discord.js'

export interface IDiscordChannelConfig {
  botToken?: string | ConfigReference<string>
  intents?: GatewayIntentBits[]
}
