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
import { Anthropic } from '@anthropic-ai/sdk'

@singleton()
export class AnthropicChatAdapter implements IChatAdapter {
  private anthropic: Anthropic
  private logger = new Logger('wabot:anthropic-chat-adapter')

  constructor(private env: Env) {
    const apiKey = this.env.requireString('ANTHROPIC_API_KEY')
    this.anthropic = new Anthropic({ apiKey })
  }

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatAdapterNextItemRes> {
    const tools = req.tools.map((x) => this.mapTool(x))

    const messages = this.mapChatItems(req.prevItems)

    const request = {
      model: req.model,
      max_tokens: 4096,
      system: req.systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    }

    this.logger.debug(`Call Claude API with Request: ${JSON.stringify(request)}`)

    const response = await this.anthropic.messages.create(request)

    return this.mapResponse(response)
  }

  private mapChatItems(chatItems: IChatItem[]): Anthropic.Messages.MessageParam[] {
    const messages: Anthropic.Messages.MessageParam[] = []

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

  private mapFunctionCall(item: IFunctionCall): Anthropic.Messages.MessageParam[] {
    return [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: item.id,
            name: item.name,
            input: JSON.parse(item.arguments || '{}'),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: item.id,
            content: item.result || 'No result',
          },
        ],
      },
    ]
  }

  private mapTool(tool: IMindsetTool) {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.reduce(
          (prev, param) => ({
            ...prev,
            [param.name]: { type: param.type, description: param.description },
          }),
          {},
        ),
        required: tool.parameters.map((param) => param.name),
      },
    }
  }

  private mapResponse(response: Anthropic.Messages.Message): IChatAdapterNextItemRes {
    let chatItem: IChatItem
    const content = response.content[0]
    if (content.type === 'text') {
      chatItem = { type: 'botMessage', botMessage: { text: content.text } }
    } else if (content.type === 'tool_use') {
      chatItem = {
        type: 'functionCall',
        functionCall: {
          id: content.id,
          name: content.name,
          arguments: JSON.stringify(content.input),
        },
      }
    } else {
      throw new Error('Not supported Claude Response')
    }

    let usage: ILanguageModelUsage
    if (response.usage) {
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    return { chatItem, usage }
  }
}
