import { ChatResolver, type IChatChannel, type IReceivedMessage, UserResolver } from '@/controller'
import type { IChatMessage } from '@/core'
import { injectable } from '@/injection'

import { Logger } from '@/logger'
import type { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import type { WhatsAppReceiver } from './WhatsAppReceiver'
import type { WhatsAppSender } from './WhatsAppSender'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  private logger = new Logger('wabot:whatsapp-channel')

  constructor(
    private config: WhatsappChannelConfig,
    private chatResolver: ChatResolver,
    private userResolver: UserResolver,
    private sender: WhatsAppSender,
    private receiver: WhatsAppReceiver,
  ) {}

  listen(callback: (message: IReceivedMessage) => void): void {
    this.receiver.listenMessage({
      to: this.config.number,
      listener: async (message) => {
        try {
          const chat = await this.chatResolver.resolve(message.chatConnection)
          const user = await this.userResolver.resolve(message.userConnection)

          callback({
            chat,
            user,
            message,
            reply: (replyMessage: IChatMessage) => {
              this.sender.sendWhatsApp({
                from: this.config.number,
                to: message.userConnection.id,
                message: replyMessage,
              })
            },
          })
        } catch (err) {
          this.logger.error(err)
        }
      },
    })
  }

  connect(): void {
    this.receiver.connect()
  }
}
