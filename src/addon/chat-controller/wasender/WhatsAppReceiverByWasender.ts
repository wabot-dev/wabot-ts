import { restController } from '@/feature/rest-controller/metadata'
import { runRestControllers } from '@/feature/rest-controller'
import { createWasender, type Wasender } from 'wasenderapi'
import {
  WasenderWebhookController,
  type IWasenderChannelMessageListener,
} from './WasenderWebhookController'

export { type IWasenderChannelMessageListener } from './WasenderWebhookController'

export class WhatsAppReceiverByWasender {
  private wasender: Wasender
  private listener: IWasenderChannelMessageListener | null = null

  constructor(
    private config: {
      apiKey: string
      webhookSecret: string
      webhookPath: string
      retryOptions?: { enabled: boolean; maxRetries: number }
    },
  ) {
    this.wasender = createWasender(
      config.apiKey,
      undefined,
      undefined,
      undefined,
      config.retryOptions,
      config.webhookSecret,
    )
  }

  listenMessage(listener: IWasenderChannelMessageListener): void {
    this.listener = listener
  }

  connect(): void {
    const wasender = this.wasender
    const listener = this.listener!

    @restController(this.config.webhookPath)
    class UniqueController extends WasenderWebhookController {
      constructor() {
        super(wasender, listener)
      }
    }

    runRestControllers([UniqueController])
  }

  disconnect(): void {
    // Nothing to disconnect
  }
}
