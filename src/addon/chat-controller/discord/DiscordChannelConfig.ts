import type { GatewayIntentBits } from 'discord.js'

export class DiscordChannelConfig {
  constructor(
    public botToken: string = '',
    public intents?: GatewayIntentBits[],
  ) {}
}
