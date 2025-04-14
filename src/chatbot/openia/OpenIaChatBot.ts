import { Mindset } from '@/mindset/Mindset'
import { IChatBot } from '../IChatBot'
import { IUserMessageItem, ISystemMessageItem, IChatItem } from '../IChatItem'
import { ChatMemory } from '../memory/ChatMemory'
import { v4 as uuidv4 } from 'uuid'

import { OpenAI } from 'openai'
const openai = new OpenAI()

export class OpenIaChatBot implements IChatBot {
  constructor(private memory: ChatMemory, private mindset: Mindset) {}

  async sendMessage(message: IUserMessageItem, callback: (message: ISystemMessageItem) => void) {
    const newChatItem = {
      id: uuidv4(),
      createdAt: new Date(),
      ...message,
    }

    await this.memory.saveItem(newChatItem)
    this.processLoop(callback)
  }

  private async processLoop(callback: (message: ISystemMessageItem) => void) {
    const lastChatItems = await this.memory.findLastItems(10)
    if (lastChatItems.length === 0) {
      return
    }
    if (lastChatItems[lastChatItems.length - 1].type === 'BOT_MESSAGE') {
      return
    }

    const tools = await this.tools()
    const system = await this.system()

    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: [...system, ...this.mapChatItems(lastChatItems)],
      tools,
    })
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    for (const item of chatItems) {
      if (item.type === 'USER_MESSAGE') {
        if (!item.content.text) {
          throw new Error('System message content is empty')
        }
        openIaInput.push({ role: 'user', content: item.content.text })
      } else if (item.type === 'BOT_MESSAGE') {
        if (!item.content.text) {
          throw new Error('System message content is empty')
        }
        openIaInput.push({ role: 'assistant', content: item.content.text })
      }
      if (item.type === 'FUNCTION_CALL') {
        openIaInput.push({
          type: 'function_call',
          call_id: item.content.foreignId,
          name: item.content.name,
          arguments: JSON.stringify(item.content.arguments),
        })
        openIaInput.push({
          type: 'function_call_output',
          call_id: item.content.foreignId,
          output: item.content.result,
        })
      }
    }
    return openIaInput
  }

  private async system(): Promise<OpenAI.Responses.ResponseInput> {
    return [{ role: 'system', content: 'You are a helpful assistant.' }]
  }

  private async tools(): Promise<OpenAI.Responses.Tool[]> {
    return []
  }
}
