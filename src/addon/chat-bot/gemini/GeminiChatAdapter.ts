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
import { GoogleGenAI } from '@google/genai'

const SUPPORTED_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
] as const

export class GeminiChatAdapter implements IChatAdapter {
  private genai: GoogleGenAI
  private logger = new Logger('wabot:gemini-chat-adapter')

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY env variable is required')
    }

    this.genai = new GoogleGenAI({ apiKey })
  }

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatAdapterNextItemRes> {
    this.validateModel(req.model)

    const geminiInput = []
    
    geminiInput.push(...this.mapChatItems(req.prevItems, req.systemPrompt))

    const tools = req.tools.map((x) => this.mapTool(x))

    const request = { 
      model: req.model, 
      contents: geminiInput, 
      tools: tools.length > 0 ? tools : undefined
    }

    this.logger.debug(`Call Gemini API with Request: ${JSON.stringify(request)}`)

    const response = await this.genai.models.generateContent(request)
    return this.mapResponse(response)
  }

  private validateModel(model: string): void {
    if (!SUPPORTED_MODELS.includes(model as any)) {
      throw new Error(
        `Unsupported Gemini model: ${model}. Supported models: ${SUPPORTED_MODELS.join(', ')}`,
      )
    }
  }

  private mapChatItems(chatItems: IChatItem[], systemPrompt?: string): Array<{ role: string; parts: Array<any> }> {
    const geminiInput: Array<{ role: string; parts: Array<any> }> = []
    
    if (systemPrompt) {
      geminiInput.push({ role: 'user', parts: [{ text: 'system: ' + systemPrompt }] })
      geminiInput.push({ role: 'model', parts: [{ text: 'I understand.' }] })
    }
    
    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          geminiInput.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          geminiInput.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          geminiInput.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }
    return geminiInput
  }

  private mapHumanMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('User message content is empty')
    }
    return { role: 'user', parts: [{ text: item.text }] }
  }

  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('Bot message content is empty')
    }
    return { role: 'model', parts: [{ text: item.text }] }
  }

  private mapFunctionCall(item: IFunctionCall) {
    return [
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: item.name,
              args: JSON.parse(item.arguments || '{}'),
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: item.name,
              response: {
                result: item.result || 'No result',
              },
            },
          },
        ],
      },
    ]
  }

  private mapTool(tool: IMindsetTool) {
    return {
      functionDeclarations: [
        {
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
        },
      ],
    }
  }

  private mapResponse(response: any): IChatAdapterNextItemRes {
    let chatItem: IChatItem
    const part = response.response.candidates[0].content.parts[0]
    if (part.text) {
      chatItem = { type: 'botMessage', botMessage: { text: part.text } }
    } else if (part.functionCall) {
      chatItem = {
        type: 'functionCall',
        functionCall: {
          id: `gemini_${Date.now()}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        },
      }
    } else {
      throw new Error('Not supported Gemini Response')
    }

    let usage: ILanguageModelUsage
    if (response.response.usageMetadata) {
      usage = {
        inputTokens: response.response.usageMetadata.promptTokenCount || 0,
        outputTokens: response.response.usageMetadata.candidatesTokenCount || 0,
      }
    } else {
      throw new Error('Unable to found usage info')
    }
    return { chatItem, usage }
  }

}
