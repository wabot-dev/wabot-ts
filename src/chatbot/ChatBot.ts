import { v4 as uuidv4 } from 'uuid'
import { ISystemMessageItem, IUserMessageItem } from './IChatItem'

import { ChatBotAdapter } from './ChatBotAdapter'
import { IChatBot } from './IChatBot'
import { ChatMemory } from './memory/IChatMemory'
import { injectable } from '@/injection'

@injectable()
export class ChatBot implements IChatBot {
  constructor(
    private memory: ChatMemory,
    private adapter: ChatBotAdapter,
  ) {
    this.memory = memory
  }

  public async sendMessage(
    message: IUserMessageItem,
    callback: (message: ISystemMessageItem) => void,
  ) {
    const newChatItem = {
      id: uuidv4(),
      createdAt: new Date(),
      ...message,
    }

    await this.memory.saveItem(newChatItem)
    this.processLoop(callback)
  }

  protected async processLoop(callback: (message: ISystemMessageItem) => void) {
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
      callback(newChatItem)
      return
    }

    this.processLoop(callback)
  }
}
