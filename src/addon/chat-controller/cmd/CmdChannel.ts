import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'

import { injectable } from '@/core/injection'

import { type IChatConnection, type IChatMessage } from '@/feature/chat-bot'
import * as readline from 'readline'

const chatId = 'cmd'

@injectable()
export class CmdChannel implements IChatChannel {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  private callBack: ((message: IChannelMessage) => void) | null = null

  listen(callback: (message: IChannelMessage) => void): void {
    this.callBack = callback
  }

  connect(): void {
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim()
      if (!trimmedInput) {
        this.rl.prompt()
        return
      }

      if (trimmedInput.toLowerCase() === 'exit') {
        this.rl.close()
        return
      }

      const chatConnection: IChatConnection = {
        id: chatId,
        chatType: 'PRIVATE',
        channelName: CmdChannel.name,
      }

      if (!this.callBack) return

      this.callBack({
        chatConnection,
        message: {
          text: trimmedInput,
        },
        reply: (message: IChatMessage) => {
          console.log(`\n[${message.senderName}]: ${message.text}\n`)
          this.rl.prompt()
        },
      })
    })
  }
}
