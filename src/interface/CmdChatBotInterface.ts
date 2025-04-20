import { ChatBotInterface } from '@/chatbot/ChatBotInterface'
import { IChatMessage } from '@/message'
import * as readline from 'readline'

export class CmdChatBotInterface extends ChatBotInterface {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  async start() {
    const ALIAS_NAME = (await this.mindset.identity()).name

    this.rl.setPrompt('> ')
    this.rl.prompt()

    this.rl.on('line', (input: string) => {
      const trimmedInput = input.trim()

      if (trimmedInput.toLowerCase() === 'exit') {
        this.rl.close()
        return
      }

      this.handleIncomingMessage({
        origin: { channelType: CmdChatBotInterface },
        chatId: 'cmd',
        reply: (message: IChatMessage) => {
          console.log(`\n[${ALIAS_NAME}]: ${message.text}\n`)
          this.rl.prompt()
        },
        message: {
          sender: { shortName: 'cmd' },
          text: trimmedInput,
        },
      })
    })
  }
}
