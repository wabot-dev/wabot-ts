import { MindsetOperator } from '@/feature/mindset'
import { ChatAdapter } from './ChatAdapter'
import { ChatItem } from './ChatItem'
import { ChatMemory } from './ChatMemory'
import { IChatBot } from './IChatBot'
import { IChatMessage } from './IChatMessage'
import { injectable } from '@/core/injection'

@injectable()
export class ChatBot implements IChatBot {
  constructor(
    private memory: ChatMemory,
    private adapter: ChatAdapter,
    private mindset: MindsetOperator,
  ) {}

  public async sendMessage(message: IChatMessage, callback: (message: IChatMessage) => void) {
    const newChatItem = new ChatItem({
      type: 'humanMessage',
      humanMessage: message,
    })
    await this.memory.create(newChatItem)
    this.processLoop(callback)
  }

  protected async processLoop(callback: (message: IChatMessage) => void) {
    const prevItems = await this.memory.findLastItems(10)
    if (prevItems.length === 0) {
      return
    }
    const lastChatItem = prevItems[prevItems.length - 1]
    if (lastChatItem.type === 'botMessage') {
      return
    }
    const systemPrompt = await this.mindset.systemPrompt()
    const tools = this.mindset.tools()
    const llms = await this.mindset.llms()
    if (llms.length === 0) {
      throw new Error(`Invalid ${this.mindset.constructor.name} - llms not found`)
    }
    const llm = llms[0]

    const { chatItem: newItemData } = await this.adapter.nextItem({
      model: llm.model,
      provider: llm.provider,
      systemPrompt,
      tools,
      prevItems: prevItems.map((x) => x.getData()),
    })

    if (newItemData.type === 'functionCall') {
      newItemData.functionCall.result = await this.mindset.callFunction(
        newItemData.functionCall.name,
        newItemData.functionCall.arguments ?? '{}',
      )
    }

    const newChatItem = new ChatItem(newItemData)
    await this.memory.create(newChatItem)

    if (newChatItem.type === 'botMessage') {
      callback(newChatItem.botMessage)
      return
    }

    this.processLoop(callback)
  }
}
