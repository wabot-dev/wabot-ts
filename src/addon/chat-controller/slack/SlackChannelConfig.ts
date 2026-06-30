import type { ConfigReference } from '@/core/config'

export interface ISlackChannelConfig {
  appToken: string | ConfigReference<string>
  botToken: string | ConfigReference<string>
  signingSecret?: string | ConfigReference<string>
}

export class SlackChannelConfig {
  constructor(
    public readonly appToken: string,
    public readonly botToken: string,
    public readonly signingSecret?: string,
  ) {}
}
