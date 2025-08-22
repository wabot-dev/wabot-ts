import { injectable } from '@/injection'

import { OpenAI } from 'openai'

import { ChatBotAdapter } from '@/chatbot'
import type { ChatItem } from '@/core'
import { MindsetOperator } from '@/mindset'

@injectable()
export class DeepSeekChatBotAdapter extends ChatBotAdapter {
  private deepSeek: OpenAI
  private model: string

  constructor(mindset: MindsetOperator) {
    super(mindset)
    const model = process.env.DEEPSEEK_CHAT_MODEL
    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseURL = process.env.DEEPSEEK_BASE_URL
    this.validateEnvVariables([model, apiKey, baseURL])
    this.model = model || 'deepseek-chat'
    this.deepSeek = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    })
  }

  validateEnvVariables(envVariables: (string | undefined)[]): void {
    envVariables.forEach((envVariable) => {
      if (!envVariable) {
        throw new Error('Missing environment variable')
      }
    })
  }

  override async generateNextChatItem(chatItems: ChatItem[]): Promise<ChatItem> {
    const systemPrompt = await this.systemPrompt()

    const tools = (await this.mindset.allFunctionsDescriptors()).map((fn) => {
      const parameters = { ...fn.parameters, additionalProperties: false, type: 'object' }
      return {
        type: 'function',
        function: { name: fn.name, description: fn.description, parameters, strict: true },
      } as const
    })

    const response = await this.deepSeek.chat.completions.create({
      model: this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...this.mapChatItems(chatItems)],
      tools: tools,
      tool_choice: 'auto',
    })

    let newChatItem: ChatItem

    const { tool_calls: responseFunctionCall, content: responseText } =
      response.choices?.[0]?.message ?? {}

    if (responseText) {
      newChatItem = await this.buildBotMessageItem(responseText)
    } else if (responseFunctionCall && responseFunctionCall[0]?.type == 'function') {
      newChatItem = await this.buildFunctionCallItem(
        responseFunctionCall[0].id,
        responseFunctionCall[0].function.name,
        responseFunctionCall[0].function.arguments,
      )
    } else {
      throw new Error('Not supported DeepSeek Response')
    }
    return newChatItem
  }

  private mapChatItems(chatItems: ChatItem[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    // const deepSeekInput: OpenAI.Chat.ChatCompletionMessageParam[] = []
    // for (const item of chatItems) {
    //   const itemData = item.getData()
    //   if (itemData.type === 'CONNECTION_MESSAGE') {
    //     if (!itemData.content.text) {
    //       throw new Error('System message content is empty')
    //     }
    //     deepSeekInput.push({ role: 'user', content: itemData.content.text })
    //   } else if (itemData.type === 'BOT_MESSAGE') {
    //     if (!itemData.content.text) {
    //       throw new Error('System message content is empty')
    //     }
    //     deepSeekInput.push({ role: 'assistant', content: itemData.content.text })
    //   }
    //   if (itemData.type === 'FUNCTION_CALL') {
    //     deepSeekInput.push({
    //       role: 'assistant',
    //       tool_calls: [
    //         {
    //           id: itemData.content.id,
    //           type: 'function',
    //           function: {
    //             name: itemData.content.name,
    //             arguments: JSON.stringify(itemData.content.arguments),
    //           },
    //         },
    //       ],
    //     })
    //     deepSeekInput.push({
    //       role: 'tool',
    //       tool_call_id: itemData.content.id,
    //       content: itemData.content.result ?? 'No result',
    //     })
    //   }
    // }
    // return deepSeekInput
    return []
  }
}
