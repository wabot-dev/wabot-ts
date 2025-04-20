import { v4 as uuidv4 } from 'uuid'
import { IChatItem } from './IChatItem'

import { injectable } from '@/injection'
import { IChatMessage } from '@/message'
import { ChatBotAdapter } from './ChatBotAdapter'
import { IChatBot } from './IChatBot'
import { ChatMemory } from './memory/IChatMemory'

@injectable()
export class ChatBot implements IChatBot {
  constructor(
    private memory: ChatMemory,
    private adapter: ChatBotAdapter,
  ) {
    this.memory = memory
  }

  public async sendMessage(message: IChatMessage, callback: (message: IChatMessage) => void) {
    const newChatItem: IChatItem = {
      id: uuidv4(),
      createdAt: new Date(),
      type: 'USER_MESSAGE',
      content: message,
    }

    await this.memory.saveItem(newChatItem)
    this.processLoop(callback)
  }

  protected async processLoop(callback: (message: IChatMessage) => void) {
    const prevChatItems = await this.memory.findLastItems(10)
    if (prevChatItems.length === 0) {
      return
    }

    const lastChatItem = prevChatItems[prevChatItems.length - 1]
    if (lastChatItem.type === 'BOT_MESSAGE') {
      return
    }

    const newChatItem = await this.adapter.generateNextChatItem(prevChatItems)
    await this.memory.saveItem(newChatItem)

    if (newChatItem.type === 'BOT_MESSAGE') {
      callback(newChatItem.content)
      return
    }

    this.processLoop(callback)
  }
}
