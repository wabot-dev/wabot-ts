import {
  IChatAdapter,
  IChatAdapterNextItemReq,
  IFunctionCall,
  IChatItem,
  IChatMessage,
} from '@/feature/chat-bot'
import { Logger } from '@/core/logger'
import { OpenAI } from 'openai'
import { IMindsetTool } from '@/feature/mindset'

export class OpenaiChatAdapter implements IChatAdapter {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-chat-adapter')

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatItem> {
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

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          openIaInput.push(this.mapConectionMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          openIaInput.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          openIaInput.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }
    return openIaInput
  }

  private mapConectionMessage(item: IChatMessage) {
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

  private mapFunctionCall(item: IFunctionCall) {
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

  private mapTool(tool: IMindsetTool) {
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

  private mapResponse(response: OpenAI.Responses.Response): IChatItem {
    let newItem: IChatItem
    if (response.output_text) {
      newItem = { type: 'botMessage', botMessage: { text: response.output_text } }
    } else if (response.output && response.output[0]?.type == 'function_call') {
      newItem = {
        type: 'functionCall',
        functionCall: {
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
