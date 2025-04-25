import { ChatResolver, type IChatChannel } from '@/controller'
import { injectable } from '@/injection'
import { type IChatMessage } from '@/core/message'

import * as readline from 'readline'
import type { IChatConnection, IMessageContext, IUserConnection } from '@/core'

@injectable()
export class CmdChannel implements IChatChannel {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  private callBack: ((message: IMessageContext) => void) | null = null

  constructor(private chatResolver: ChatResolver) {}

  listen(callback: (message: IMessageContext) => void): void {
    this.callBack = callback
  }

  connect(): void {
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim()

      if (trimmedInput.toLowerCase() === 'exit') {
        this.rl.close()
        return
      }

      const chatConnection: IChatConnection = {
        id: 'cmd',
        chatType: 'PRIVATE',
        channelName: CmdChannel.name,
      }

      const chat = await this.chatResolver.resolve(chatConnection)

      const userConnection: IUserConnection = {
        id: 'cmd',
        channelName: CmdChannel.name,
      }

      if (!this.callBack) return

      this.callBack({
        chat,
        message: {
          chatConnection,
          userConnection,
          text: trimmedInput,
          senderName: 'cmd',
        },
        reply: (message: IChatMessage) => {
          console.log(`\n[${message.senderName}]: ${message.text}\n`)
          this.rl.prompt()
        },
      })
    })
  }
}
