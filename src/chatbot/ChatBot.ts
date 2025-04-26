import { v4 as uuidv4 } from 'uuid'
import { type IChatMessage, type IConnectionChatMessage } from '@/core/message'
import { ChatBotAdapter } from './ChatBotAdapter'
import { type IChatBot } from './IChatBot'
import { ChatMemory, type IChatItem } from '../core/chat'
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
    message: IConnectionChatMessage,
    callback: (message: IChatMessage) => void,
  ) {
    const newChatItem: IChatItem = {
      id: uuidv4(),
      createdAt: new Date(),
      type: 'CONNECTION_MESSAGE',
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
