import {
  ChatResolver,
  type IChatChannel,
  type IMessageContext,
  type IMessageOrigin,
} from '@/controller'
import { injectable } from '@/injection'
import { type IChatMessage } from '@/message'

import * as readline from 'readline'

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

      const origin: IMessageOrigin = {
        chatId: 'cmd',
        chatType: 'PRIVATE',
        channelType: CmdChannel,
      }

      const chat = await this.chatResolver.resolve(origin)

      if (!this.callBack) return

      this.callBack({
        chatId: chat.getId(),
        origin,
        message: {
          text: trimmedInput,
          sender: {
            shortName: 'Cmd',
          },
        },
        reply: (message: IChatMessage) => {
          console.log(`\n[${message.sender.shortName}]: ${message.text}\n`)
          this.rl.prompt()
        },
      })
    })
  }
}
