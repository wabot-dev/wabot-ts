import { ChatResolver, type IChatChannel, type IReceivedMessage, UserResolver } from '@/controller'
import type { IChatMessage } from '@/core'
import { WabotEnv } from '@/env'
import { injectable } from '@/injection'
import { Logger } from '@/logger'
import type { IWhatsAppConnection } from './IWhatsAppConnection'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import { WhatsAppDevConnection } from './WhatsAppDevConnection'
import { WhatsAppProdConnection } from './WhatsAppProdConnection'

@injectable()
export class WhatsAppChannel implements IChatChannel {
  private logger = new Logger('wabot:whatsapp-channel')
  private whatsAppConection: IWhatsAppConnection

  constructor(
    private config: WhatsappChannelConfig,
    private chatResolver: ChatResolver,
    private userResolver: UserResolver,
    private wabotEnv: WabotEnv,
    devConnection: WhatsAppDevConnection,
    prodConnection: WhatsAppProdConnection,
  ) {
    this.whatsAppConection = this.wabotEnv.isProduction() ? prodConnection : devConnection
  }

  listen(callback: (message: IReceivedMessage) => void): void {
    this.whatsAppConection.listenMessage(this.config.number, async (message) => {
      try {
        const chat = await this.chatResolver.resolve(message.chatConnection)
        const user = await this.userResolver.resolve(message.userConnection)

        callback({
          chat,
          user,
          message,
          reply: (replyMessage: IChatMessage) => {
            this.whatsAppConection.sendWhatsApp(
              this.config.number,
              message.userConnection.id,
              replyMessage,
            )
          },
        })
      } catch (err) {
        this.logger.error(err)
      }
    })
  }

  connect(): void {
    this.whatsAppConection.connect()
  }
}
