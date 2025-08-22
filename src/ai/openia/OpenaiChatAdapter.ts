import { IChatAdapter, IChatAdapterNextItemReq, IChatTool } from '@/chatbot'
import { IChatFunctionCall, IChatItemRawData, IChatMessage, IConnectionChatMessage } from '@/core'
import { Logger } from '@/logger'
import { OpenAI } from 'openai'

export class OpenaiChatAdapter implements IChatAdapter {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-chat-adapter')

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatItemRawData> {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    openIaInput.push({ role: 'system', content: req.systemPrompt })
    openIaInput.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    const response = await this.openai.responses.create({
      model: req.model,
      input: openIaInput,
      tools,
    })

    return this.mapResponse(response)
  }

  private mapChatItems(chatItems: IChatItemRawData[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    for (const { type, content } of chatItems) {
      switch (type) {
        case 'CONNECTION_MESSAGE':
          openIaInput.push(this.mapConectionMessage(content))
          break
        case 'BOT_MESSAGE':
          openIaInput.push(this.mapBotMessage(content))
          break
        case 'FUNCTION_CALL':
          openIaInput.push(...this.mapFunctionCall(content))
          break
      }
    }
    return openIaInput
  }

  private mapConectionMessage(item: IConnectionChatMessage) {
    if (!item.text) {
      throw new Error('System message content is empty')
    }
    return { role: 'user', content: item.text } as const
  }

  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('System message content is empty')
    }
    return { role: 'assistant', content: item.text } as const
  }

  private mapFunctionCall(item: IChatFunctionCall) {
    return [
      {
        type: 'function_call',
        call_id: item.id,
        name: item.name,
        arguments: JSON.stringify(item.arguments),
      },
      {
        type: 'function_call_output',
        call_id: item.id,
        output: item.result ?? 'Not result',
      },
    ] as const
  }

  private mapTool(tool: IChatTool) {
    return {
      type: 'function',
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
      },
      strict: true,
    } as const
  }

  private mapResponse(response: OpenAI.Responses.Response): IChatItemRawData {
    let newItem: IChatItemRawData
    if (response.output_text) {
      newItem = { type: 'BOT_MESSAGE', content: { text: response.output_text } }
    } else if (response.output && response.output[0]?.type == 'function_call') {
      newItem = {
        type: 'FUNCTION_CALL',
        content: {
          id: response.output[0].call_id,
          name: response.output[0].name,
          arguments: response.output[0].arguments,
        },
      }
    } else {
      throw new Error('Not supported OpenIA Response')
    }
    return newItem
  }
}
