import { ChatResolver, type IChatChannel, type IReceivedMessage } from '@/controller'
import { type IChatMessage } from '@/core/message'
import { injectable } from '@/injection'
import { v4 as uuidv4 } from 'uuid'

import type { IChatConnection, IUserConnection } from '@/core'
import * as readline from 'readline'

@injectable()
export class CmdChannel implements IChatChannel {
  chatId = uuidv4()
  userId = uuidv4()

  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  private callBack: ((message: IReceivedMessage) => void) | null = null

  constructor(private chatResolver: ChatResolver) {}

  listen(callback: (message: IReceivedMessage) => void): void {
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
        id: this.chatId,
        chatType: 'PRIVATE',
        channelName: CmdChannel.name,
      }

      const chat = await this.chatResolver.resolve(chatConnection)

      const userConnection: IUserConnection = {
        id: this.userId,
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
