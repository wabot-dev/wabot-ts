import { ChatResolver, type IChatChannel, type IReceivedMessage, UserResolver } from '@/controller'
import type { IChatMessage } from '@/core'
import type { WabotEnv } from '@/env'
import { injectable } from '@/injection'
import { Logger } from '@/logger'
import type { IWhatsAppConnection } from './IWhatsAppConnection'
import { WhatsappChannelConfig } from './WhatsAppChannelConfig'
import type { WhatsAppDevConnection } from './WhatsAppDevConnection'
import type { WhatsAppProdConnection } from './WhatsAppProdConnection'

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
    })
  }

  connect(): void {
    this.whatsAppConection.connect()
  }
}
