import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import {
  IChatAdapter,
  IChatAdapterNextItemReq,
  IChatAdapterNextItemRes,
  IChatItem,
  IChatMessage,
  IFunctionCall,
  ILanguageModelUsage,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import OpenAI from 'openai'

@singleton()
export class GoogleChatAdapter implements IChatAdapter {
  private openai: OpenAI
  private logger = new Logger('wabot:google-chat-adapter')

  constructor(private env: Env) {
    const apiKey = this.env.requireString('GOOGLE_API_KEY')
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  }

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatAdapterNextItemRes> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    // Add system prompt as system message
    messages.push({ role: 'system', content: req.systemPrompt })
    
    // Add previous chat items
    messages.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    const request = {
      model: req.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: 'auto' as const,
    }

    this.logger.debug(`Call Gemini API with Request: ${JSON.stringify(request)}`)

    const response = await this.openai.chat.completions.create(request)
    return this.mapResponse(response)
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          messages.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          messages.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          messages.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }

    return messages
  }

  private mapHumanMessage(item: IChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (!item.text) {
      throw new Error('User message content is empty')
    }
    return { role: 'user', content: item.text }
  }

  private mapBotMessage(item: IChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (!item.text) {
      throw new Error('Bot message content is empty')
    }
    return { role: 'assistant', content: item.text }
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

  private mapResponse(response: OpenAI.Chat.ChatCompletion): IChatAdapterNextItemRes {
    let chatItem: IChatItem

    const { tool_calls: responseFunctionCall, content: responseText } =
      response.choices?.[0]?.message ?? {}

    if (responseText) {
      chatItem = { type: 'botMessage', botMessage: { text: responseText } }
    } else if (responseFunctionCall && responseFunctionCall[0]?.type === 'function') {
      chatItem = {
        type: 'functionCall',
        functionCall: {
          id: responseFunctionCall[0].id,
          name: responseFunctionCall[0].function.name,
          arguments: responseFunctionCall[0].function.arguments,
        },
      }
    } else {
      throw new Error('Not supported Gemini Response')
    }

    let usage: ILanguageModelUsage
    if (response.usage) {
      usage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    return { chatItem, usage }
  }
}