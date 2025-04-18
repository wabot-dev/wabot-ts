import { injectable } from '@/injection'
import { IChatItem } from '../IChatItem'

import { OpenAI } from 'openai'

import { MindsetOperator } from '@/mindset/MindsetOperator'
import { ChatBotAdapter } from '../ChatBotAdapter'

@injectable()
export class OpenaiChatBotAdapter extends ChatBotAdapter {
  private openai = new OpenAI()
  private model: string

  constructor(mindset: MindsetOperator) {
    super(mindset)
    const model = process.env.OPENAI_CHAT_MODEL
    if (!model) {
      throw new Error(`OPENAI_CHAT_MODEL env variable is required`)
    }
    this.model = model
  }

  override async generateNextChatItem(chatItems: IChatItem[]): Promise<IChatItem> {
    const systemPrompt = await this.systemPrompt()

    const tools = (await this.mindset.allFunctionsDescriptors()).map((fn) => {
      const parameters = { ...fn.parameters, additionalProperties: false, type: 'object' }
      return { ...fn, type: 'function', parameters, strict: true } as const
    })

    const response = await this.openai.responses.create({
      model: this.model,
      input: [{ role: 'system', content: systemPrompt }, ...this.mapChatItems(chatItems)],
      tools,
    })

    let newChatItem: IChatItem
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
}
