import { ChatItem, ChatMemory, type IChatMessage, type IConnectionChatMessage } from '@/core'
import { injectable } from '@/injection'
import { ChatBotAdapter } from './ChatBotAdapter'
import { type IChatBot } from './IChatBot'

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
    const newChatItem = new ChatItem({
      type: 'CONNECTION_MESSAGE',
      content: message,
    })

    await this.memory.create(newChatItem)
    this.processLoop(callback)
  }

  protected async processLoop(callback: (message: IChatMessage) => void) {
    const prevChatItems = await this.memory.findLastItems(10)
    if (prevChatItems.length === 0) {
      return
    }

    const lastChatItem = prevChatItems[prevChatItems.length - 1]
    const lastItemType = lastChatItem.getType()
    if (lastItemType === 'BOT_MESSAGE') {
      return
    }

    const newChatItem = await this.adapter.generateNextChatItem(prevChatItems)
    await this.memory.create(newChatItem)

    const newChatItemData = newChatItem.getData()

    if (newChatItemData.type === 'BOT_MESSAGE') {
      callback(newChatItemData.content)
      return
    }

    this.processLoop(callback)
  }
}
