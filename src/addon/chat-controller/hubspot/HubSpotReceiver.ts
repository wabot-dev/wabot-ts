import { restController } from '@/feature/rest-controller/metadata'
import { runRestControllers } from '@/feature/rest-controller'

import { HubSpotChannelConfig } from './HubSpotChannelConfig'
import { HubSpotWebhookController, IHubSpotMessageListener } from './HubSpotWebhookController'

export class HubSpotReceiver {
  private listener: IHubSpotMessageListener | null = null

  constructor(private config: HubSpotChannelConfig) {}

  listenMessage(listener: IHubSpotMessageListener): void {
    this.listener = listener
  }

  connect(): void {
    const listener = this.listener
    if (!listener) {
      throw new Error('HubSpotReceiver.connect() called before listenMessage()')
    }
    const webhookPath = this.config.webhookPath
    const webhookSecret = this.config.webhookSecret
    const accessToken = this.config.accessToken
    const channelName = this.config.channelName

    @restController(webhookPath)
    class UniqueController extends HubSpotWebhookController {
      constructor() {
        super({ webhookSecret, accessToken, listener: listener!, channelName })
      }
    }

    runRestControllers([UniqueController])
  }

  disconnect(): void {
    // No-op: the webhook is registered with Express and lives until the app shuts down.
  }
}
