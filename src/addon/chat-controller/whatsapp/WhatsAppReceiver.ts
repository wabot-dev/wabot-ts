import type { IChatConnection } from '@/feature/chat-bot'
import type { Logger } from '@/core/logger'
import type {
  IMessageMetadata,
  IWhatsAppContact,
  IWhatsAppMessage,
  IWhatsAppWebhookPayload,
} from './IWhatsAppWebHookPayload'
import { IChannelMessage } from '@/feature/chat-controller'

export type IWhatsAppMessageListener = (message: Omit<IChannelMessage, 'reply'>) => Promise<void>

export interface IListenWhatsAppMessageRequest {
  to: string
  listener: IWhatsAppMessageListener
}

export abstract class WhatsAppReceiver {
  private listeners: Map<string, IWhatsAppMessageListener> = new Map()

  constructor(protected logger: Logger) {}

  abstract connect(): Promise<void>

  listenMessage(request: IListenWhatsAppMessageRequest): void {
    this.listeners.set(request.to, request.listener)
  }

  protected async handlePayload(payload: IWhatsAppWebhookPayload) {
    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== 'messages' || !change.value.messages || !change.value.contacts) {
            continue
          }
          for (const message of change.value.messages) {
            const contact = change.value.contacts.find((x) => x.wa_id === message.from)
            if (!contact) {
              continue
            }
            await this.emmitMessage(change.value.metadata, message, contact)
          }
        }
      }
    } catch (err) {
      this.logger.error(err)
    }
  }

  private async emmitMessage(
    metadata: IMessageMetadata,
    message: IWhatsAppMessage,
    contact: IWhatsAppContact,
  ) {
    const listener = this.listeners.get(metadata.display_phone_number)
    if (!listener) {
      return
    }
    if (message.type !== 'text') {
      this.logger.error(`message type ${message.type} is not supported yet`)
      return
    }

    const channelName = 'WhatsAppChannel'

    const chatConnection: IChatConnection = {
      id: contact.wa_id,
      chatType: 'PRIVATE',
      channelName,
    }

    await listener({
      chatConnection,
      message: {
        senderName: contact.profile.name,
        text: message.text.body,
      },
    })
  }
}
