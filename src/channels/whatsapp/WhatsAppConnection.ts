import type { IChatConnection, IChatMessage, IUserConnection } from '@/core'
import { Logger } from '@/logger'
import type { IWhatsAppConnection, IWhatsAppMessageListener } from './IWhatsAppConnection'
import type {
  IMessageMetadata,
  IWhatsAppContact,
  IWhatsAppMessage,
  IWhatsAppWebhookPayload,
} from './IWhatsAppWebHookPayload'

export abstract class WhatsAppConnection implements IWhatsAppConnection {
  private listeners: Map<string, IWhatsAppMessageListener> = new Map()

  constructor(protected logger: Logger) {}

  abstract sendWhatsApp(
    businessNumber: string,
    to: string,
    chatMessage: IChatMessage,
  ): Promise<void>
  abstract connect(): void

  listenMessage(businessNumber: string, listener: IWhatsAppMessageListener): void {
    this.listeners.set(businessNumber, listener)
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

    const userConnection: IUserConnection = {
      id: contact.wa_id,
      channelName,
    }

    await listener({
      chatConnection,
      userConnection,
      senderName: contact.profile.name,
      text: message.text.body,
    })
  }
}
