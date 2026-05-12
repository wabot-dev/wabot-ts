import type { ConfigReference } from '@/core/config'

export interface IWhatsappChannelConfig {
  number: string | ConfigReference<string>
  accessToken?: string | ConfigReference<string>
  businessNumberId?: string | ConfigReference<string>
}

export class WhatsappChannelConfig {
  constructor(
    public number: string,
    public accessToken?: string,
    public businessNumberId?: string,
  ) {}
}
