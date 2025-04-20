import { ISystemMessageItem } from '@/chatbot'
import { Chat } from '@/chat'

import * as readline from 'readline'
import { ChatBotInterface } from '@/chatbot/ChatBotInterface'
import { v4 as uuidv4 } from 'uuid'

export class CmdChatBotInterface extends ChatBotInterface {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  async start() {
    const chat = new Chat({ id: uuidv4(), createdAt: new Date(), type: 'SINGLE_PERSON' })
    await this.chatMemoryRepository.create(chat)

    const ALIAS_NAME = (await this.mindset.identity()).name

    this.rl.setPrompt('> ')
    this.rl.prompt()

    this.rl.on('line', (input: string) => {
      const trimmedInput = input.trim()

      if (trimmedInput.toLowerCase() === 'exit') {
        console.log(`${ALIAS_NAME}: Bye!`)
        this.rl.close()
        return
      }

      this.handleIncomingMessage(
        {
          userId: 'cmd',
          chat: {
            chatId: chat.getId(),
            out: (message: ISystemMessageItem) => {
              console.log(`\n[${ALIAS_NAME}]: ${message.content.text}\n`)
              this.rl.prompt()
            },
          },
        },
        { sender: { userName: 'cmd' }, text: trimmedInput },
      )
    })
  }
}
