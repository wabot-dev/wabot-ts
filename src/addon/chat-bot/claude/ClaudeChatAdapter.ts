import { Logger } from '@/core/logger'
import {
  IChatAdapter,
  IChatAdapterNextItemReq,
  IChatItem,
  IChatMessage,
  IFunctionCall,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import { Anthropic } from '@anthropic-ai/sdk'

export class ClaudeChatAdapter implements IChatAdapter {
  private anthropic: Anthropic
  private logger = new Logger('wabot:claude-chat-adapter')

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY env variable is required')
    }

    this.anthropic = new Anthropic({ apiKey })
  }

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatItem> {
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

  private mapResponse(response: Anthropic.Messages.Message): IChatItem {
    const content = response.content[0]

    if (content.type === 'text') {
      return { type: 'botMessage', botMessage: { text: content.text } }
    } else if (content.type === 'tool_use') {
      return {
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
  }
}
