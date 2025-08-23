import { IChatAdapter, IChatAdapterNextItemReq, IChatTool } from '@/chatbot'
import { IChatFunctionCall, IChatItemRawData, IChatMessage, IConnectionChatMessage } from '@/core'
import { Logger } from '@/logger'
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

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatItemRawData> {
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

  private mapChatItems(chatItems: IChatItemRawData[]): Anthropic.Messages.MessageParam[] {
    const messages: Anthropic.Messages.MessageParam[] = []

    for (const { type, content } of chatItems) {
      switch (type) {
        case 'CONNECTION_MESSAGE':
          messages.push(this.mapConnectionMessage(content))
          break
        case 'BOT_MESSAGE':
          messages.push(this.mapBotMessage(content))
          break
        case 'FUNCTION_CALL':
          messages.push(...this.mapFunctionCall(content))
          break
      }
    }

    return messages
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

  private mapFunctionCall(item: IChatFunctionCall): Anthropic.Messages.MessageParam[] {
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

  private mapTool(tool: IChatTool) {
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

  private mapResponse(response: Anthropic.Messages.Message): IChatItemRawData {
    const content = response.content[0]

    if (content.type === 'text') {
      return { type: 'BOT_MESSAGE', content: { text: content.text } }
    } else if (content.type === 'tool_use') {
      return {
        type: 'FUNCTION_CALL',
        content: {
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
