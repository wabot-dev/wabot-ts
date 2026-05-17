import type { ConfigReference } from '@/core/config'

export interface ITelegramChannelConfig {
  botToken: string | ConfigReference<string>
}

export class TelegramChannelConfig {
  constructor(public botToken: string) {}
}
