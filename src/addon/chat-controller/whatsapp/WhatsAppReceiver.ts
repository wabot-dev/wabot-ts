import { IChannelMessage } from '@/feature/chat-controller'

export type IWhatsAppMessageListener = (message: Omit<IChannelMessage, 'reply'>) => Promise<void>

export interface IListenWhatsAppMessageRequest {
  to: string
  listener: IWhatsAppMessageListener
}

export class WhatsAppReceiver {
  connect(): Promise<void> {
    throw new Error('Not Implemented')
  }

  listenMessage(request: IListenWhatsAppMessageRequest): void {
    throw new Error('Not Implemented')
  }
}
