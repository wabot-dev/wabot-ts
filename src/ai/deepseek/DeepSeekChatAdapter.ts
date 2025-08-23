import { IChatAdapter, IChatAdapterNextItemReq, IChatTool } from '@/chatbot'
import { IChatFunctionCall, IChatItemRawData, IChatMessage, IConnectionChatMessage } from '@/core'
import { Logger } from '@/logger'
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

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatItemRawData> {
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

  private mapChatItems(chatItems: IChatItemRawData[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const deepSeekInput: OpenAI.Chat.ChatCompletionMessageParam[] = []

    for (const { type, content } of chatItems) {
      switch (type) {
        case 'CONNECTION_MESSAGE':
          deepSeekInput.push(this.mapConnectionMessage(content))
          break
        case 'BOT_MESSAGE':
          deepSeekInput.push(this.mapBotMessage(content))
          break
        case 'FUNCTION_CALL':
          deepSeekInput.push(...this.mapFunctionCall(content))
          break
      }
    }

    return deepSeekInput
  }

  private mapConnectionMessage(item: IConnectionChatMessage) {
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

  private mapFunctionCall(item: IChatFunctionCall): OpenAI.Chat.ChatCompletionMessageParam[] {
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

  private mapTool(tool: IChatTool) {
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

  private mapResponse(response: OpenAI.Chat.ChatCompletion): IChatItemRawData {
    const { tool_calls: responseFunctionCall, content: responseText } =
      response.choices?.[0]?.message ?? {}

    if (responseText) {
      return { type: 'BOT_MESSAGE', content: { text: responseText } }
    } else if (responseFunctionCall && responseFunctionCall[0]?.type === 'function') {
      return {
        type: 'FUNCTION_CALL',
        content: {
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
