import { ISystemMessageItem, RamChatMemoryRepository } from '@/chatbot'
import { IMindset } from '@/mindset'
import { MindsetInterface } from '@/mindset/MindsetInterface'
import { IConstructor } from '@/shared'
import { Chat } from '@/chat'

import * as readline from 'readline'

export class MindsetCmdInterface extends MindsetInterface {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  constructor(mindsetConstructor: IConstructor<IMindset>) {
    const chatMemoryRepository = new RamChatMemoryRepository()

    super(mindsetConstructor, chatMemoryRepository)
  }

  async start() {
    const chat = new Chat({ id: 'cmd-chat', createdAt: new Date(), type: 'SINGLE_PERSON' })
    this.chatMemoryRepository.create(chat)

    console.log('Start chatting! Type a message and hit Enter.\n')
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
