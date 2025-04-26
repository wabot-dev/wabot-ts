import { ChatResolver, UserResolver, type IChatChannel, type IReceivedMessage } from '@/controller'

import { injectable } from '@/injection'
import { v4 as uuidv4 } from 'uuid'

import { type IChatConnection, type IChatMessage, type IUserConnection } from '@/core'
import * as readline from 'readline'

const chatId = uuidv4()
const userId = uuidv4()

@injectable()
export class CmdChannel implements IChatChannel {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  private callBack: ((message: IReceivedMessage) => void) | null = null

  constructor(
    private chatResolver: ChatResolver,
    private userResolver: UserResolver,
  ) {}

  listen(callback: (message: IReceivedMessage) => void): void {
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

      const chat = await this.chatResolver.resolve(chatConnection)

      const userConnection: IUserConnection = {
        id: userId,
        channelName: CmdChannel.name,
      }

      const user = await this.userResolver.resolve(userConnection)

      if (!this.callBack) return

      this.callBack({
        chat,
        user,
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
