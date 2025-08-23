import { Logger } from '@/core/logger'
import {
  IChatAdapter,
  IChatAdapterNextItemReq,
  IChatItem,
  IChatMessage,
  IFunctionCall,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import { OpenAI } from 'openai'

export class DeepSeekChatAdapter implements IChatAdapter {
  private deepSeek: OpenAI
  private logger = new Logger('wabot:deepseek-chat-adapter')

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseURL = process.env.DEEPSEEK_BASE_URL

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY env variable is required')
    }
    if (!baseURL) {
      throw new Error('DEEPSEEK_BASE_URL env variable is required')
    }

    this.deepSeek = new OpenAI({
      apiKey,
      baseURL,
    })
  }

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatItem> {
    const deepSeekInput: OpenAI.Chat.ChatCompletionMessageParam[] = []
    deepSeekInput.push({ role: 'system', content: req.systemPrompt })
    deepSeekInput.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    const response = await this.deepSeek.chat.completions.create({
      model: req.model,
      messages: deepSeekInput,
      tools,
      tool_choice: 'auto',
    })

    return this.mapResponse(response)
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const deepSeekInput: OpenAI.Chat.ChatCompletionMessageParam[] = []

    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          deepSeekInput.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          deepSeekInput.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          deepSeekInput.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }

    return deepSeekInput
  }

  private mapHumanMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('User message content is empty')
    }
    return { role: 'user', content: item.text } as const
  }

  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('Assistant message content is empty')
    }
    return { role: 'assistant', content: item.text } as const
  }

  private mapFunctionCall(item: IFunctionCall): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: item.id,
            type: 'function',
            function: {
              name: item.name,
              arguments: item.arguments || '{}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: item.id,
        content: item.result ?? 'No result',
      },
    ]
  }

  private mapTool(tool: IMindsetTool) {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce(
            (prev, param) => ({
              ...prev,
              [param.name]: { type: param.type, description: param.description },
            }),
            {},
          ),
          required: tool.parameters.map((param) => param.name),
          additionalProperties: false,
        },
        strict: true,
      },
    } as const
  }

  private mapResponse(response: OpenAI.Chat.ChatCompletion): IChatItem {
    const { tool_calls: responseFunctionCall, content: responseText } =
      response.choices?.[0]?.message ?? {}

    if (responseText) {
      return { type: 'botMessage', botMessage: { text: responseText } }
    } else if (responseFunctionCall && responseFunctionCall[0]?.type === 'function') {
      return {
        type: 'functionCall',
        functionCall: {
          id: responseFunctionCall[0].id,
          name: responseFunctionCall[0].function.name,
          arguments: responseFunctionCall[0].function.arguments,
        },
      }
    } else {
      throw new Error('Not supported DeepSeek Response')
    }
  }
}
