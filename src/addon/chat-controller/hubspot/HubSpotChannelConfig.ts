import { hubspotChannelName } from './hubspotChannelName'

export class HubSpotChannelConfig {
  public readonly channelName: typeof hubspotChannelName
  public readonly accessToken: string
  public readonly webhookSecret: string
  public readonly webhookPath: string
  public readonly appId: string | undefined
  public readonly senderActorId: string | undefined

  constructor(config: {
    accessToken: string
    webhookSecret: string
    webhookPath?: string
    appId?: string
    senderActorId?: string
  }) {
    this.channelName = hubspotChannelName
    this.accessToken = config.accessToken
    this.webhookSecret = config.webhookSecret
    this.webhookPath = config.webhookPath ?? '/hubspot/webhook'
    this.appId = config.appId
    this.senderActorId = config.senderActorId
  }
}
