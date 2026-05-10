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

  public async sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => Promise<void>,
  ) {
    const newChatItem = new ChatItem({
      type: 'humanMessage',
      humanMessage: message,
    })
    await this.memory.create(newChatItem)
    await this.processLoop(callback)
  }

  protected async processLoop(callback: (message: IChatMessage) => Promise<void>) {
    const prevItems = await this.memory.findLastItems(16)
    if (prevItems.length === 0) {
      return
    }
    const lastChatItem = prevItems[prevItems.length - 1]
    if (lastChatItem.type === 'botMessage') {
      return
    }

    const systemPrompt = await this.mindset.systemPrompt()
    const tools = this.mindset.tools()
    const identity = await this.mindset.identity()

    const needsVision = prevItems.some((item) => {
      const data = item.getData()
      return data.type === 'humanMessage' && (data.humanMessage.images?.length ?? 0) > 0
    })
    const kind = needsVision ? 'visionLlm' : 'llm'
    const candidates = await this.mindset.resolveModels(kind)
    if (candidates.length === 0) {
      throw new Error(
        `Invalid ${this.mindset.constructor.name} - no model resolved for kind '${kind}'`,
      )
    }

    const { nextItems: newItemsData } = await this.adapter.nextItems({
      models: candidates,
      systemPrompt,
      tools,
      prevItems: prevItems.map((x) => x.getData()),
    })

    for (const newItemData of newItemsData) {
      if (newItemData.type === 'functionCall') {
        newItemData.functionCall.result = await this.mindset.callFunction(
          newItemData.functionCall.name,
          newItemData.functionCall.arguments ?? '{}',
        )
      } else if (newItemData.type === 'botMessage') {
        newItemData.botMessage.senderName = identity.name
      }

      const newChatItem = new ChatItem(newItemData)
      await this.memory.create(newChatItem)

      if (newItemData.type === 'botMessage') {
        await callback(newChatItem.botMessage)
      }
    }

    if (newItemsData.length == 0 || newItemsData[newItemsData.length - 1].type === 'botMessage') {
      return
    }
    await this.processLoop(callback)
  }
}
