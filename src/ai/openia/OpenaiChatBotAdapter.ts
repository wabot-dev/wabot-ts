import { injectable } from '@/injection'

import { OpenAI } from 'openai'

import { ChatBotAdapter } from '@/chatbot'
import type { ChatItem } from '@/core'
import { MindsetOperator } from '@/mindset'
import { Logger } from '@/logger'

@injectable()
export class OpenaiChatBotAdapter extends ChatBotAdapter {
  private openai = new OpenAI()
  private model: string
  private logger = new Logger('wabot:openai-chat-bot-adapter')

  constructor(mindset: MindsetOperator) {
    super(mindset)
    const model = process.env.OPENAI_CHAT_MODEL
    if (!model) {
      throw new Error(`OPENAI_CHAT_MODEL env variable is required`)
    }
    this.model = model
  }

  override async generateNextChatItem(chatItems: ChatItem[]): Promise<ChatItem> {
    const systemPrompt = await this.systemPrompt()

    const tools = (await this.mindset.allFunctionsDescriptors()).map((fn) => {
      const parameters = { ...fn.parameters, additionalProperties: false, type: 'object' }
      return { ...fn, type: 'function', parameters, strict: true } as const
    })

    const request = {
      model: this.model,
      input: [{ role: 'system', content: systemPrompt } as const, ...this.mapChatItems(chatItems)],
      tools,
    } as const

    this.logger.debug(`Call Api with Request: ${JSON.stringify(request)}`)

    const response = await this.openai.responses.create(request as any)

    let newChatItem: ChatItem
    if (response.output_text) {
      newChatItem = await this.buildBotMessageItem(response.output_text)
    } else if (response.output && response.output[0]?.type == 'function_call') {
      newChatItem = await this.buildFunctionCallItem(
        response.output[0].call_id,
        response.output[0].name,
        response.output[0].arguments,
      )
    } else {
      throw new Error('Not supported OpenIA Response')
    }
    return newChatItem
  }

  private mapChatItems(chatItems: ChatItem[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    for (const item of chatItems) {
      const itemData = item.getData()
      if (itemData.type === 'CONNECTION_MESSAGE') {
        if (!itemData.content.text) {
          throw new Error('System message content is empty')
        }
        openIaInput.push({ role: 'user', content: itemData.content.text })
      } else if (itemData.type === 'BOT_MESSAGE') {
        if (!itemData.content.text) {
          throw new Error('System message content is empty')
        }
        openIaInput.push({ role: 'assistant', content: itemData.content.text })
      }
      if (itemData.type === 'FUNCTION_CALL') {
        openIaInput.push({
          type: 'function_call',
          call_id: itemData.content.id,
          name: itemData.content.name,
          arguments: JSON.stringify(itemData.content.arguments),
        })
        openIaInput.push({
          type: 'function_call_output',
          call_id: itemData.content.id,
          output: itemData.content.result ?? 'Not result',
        })
      }
    }
    return openIaInput
  }
}
