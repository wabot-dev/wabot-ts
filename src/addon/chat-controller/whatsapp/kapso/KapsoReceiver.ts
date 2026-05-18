import { restController } from '@/feature/rest-controller/metadata'
import { runRestControllers } from '@/feature/rest-controller'
import {
  KapsoWebhookController,
  type IKapsoChannelMessageListener,
} from './KapsoWebhookController'

export { type IKapsoChannelMessageListener } from './KapsoWebhookController'

export class KapsoReceiver {
  private listener: IKapsoChannelMessageListener | null = null

  constructor(
    private config: {
      webhookSecret?: string
      webhookPath: string
    },
  ) {}

  listenMessage(listener: IKapsoChannelMessageListener): void {
    this.listener = listener
  }

  connect(): void {
    const webhookSecret = this.config.webhookSecret
    const listener = this.listener!

    @restController(this.config.webhookPath)
    class UniqueController extends KapsoWebhookController {
      constructor() {
        super(webhookSecret, listener)
      }
    }

    runRestControllers([UniqueController])
  }

  disconnect(): void {
    // Nothing to disconnect
  }
}
