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

const DEFAULT_MODEL = 'gemini-1.5-flash'

export class GeminiChatAdapter implements IChatAdapter {
  private genai: GoogleGenAI
  private model: string
  private logger = new Logger('wabot:gemini-chat-adapter')

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY env variable is required')
    }

    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL
    this.validateModel(this.model)
    this.genai = new GoogleGenAI({ apiKey })
  }

  private validateModel(model: string): void {
    if (!SUPPORTED_MODELS.includes(model as any)) {
      throw new Error(`Unsupported Gemini model: ${model}. Supported models: ${SUPPORTED_MODELS.join(', ')}`)
    }
  }

  async nextItem(req: IChatAdapterNextItemReq): Promise<IChatAdapterNextItemRes> {
    const contents = this.buildContents(req.prevItems, req.systemPrompt)
    const tools = req.tools.length > 0 ? req.tools.map(this.mapTool) : undefined

    const request = { model: this.model, contents, tools }

    this.logger.debug(`Call Gemini API with Request: ${JSON.stringify(request)}`)

    const response = await this.genai.models.generateContent(request)
    return this.mapResponse(response)
  }

  private buildContents(chatItems: IChatItem[], systemPrompt: string): Array<{ role: string; parts: Array<any> }> {
    const contents: Array<{ role: string; parts: Array<any> }> = []

    if (systemPrompt) {
      contents.push(
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I will follow these instructions.' }] }
      )
    }

    chatItems.forEach(chatItem => {
      switch (chatItem.type) {
        case 'humanMessage':
          this.validateMessageContent(chatItem.humanMessage.text, 'User')
          contents.push({ role: 'user', parts: [{ text: chatItem.humanMessage.text }] })
          break
        case 'botMessage':
          this.validateMessageContent(chatItem.botMessage.text, 'Assistant')
          contents.push({ role: 'model', parts: [{ text: chatItem.botMessage.text }] })
          break
        case 'functionCall':
          contents.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    })

    return contents
  }

  private validateMessageContent(text: string | undefined, messageType: string): void {
    if (!text) {
      throw new Error(`${messageType} message content is empty`)
    }
  }

  private mapFunctionCall(item: IFunctionCall): Array<{ role: string; parts: Array<any> }> {
    const args = JSON.parse(item.arguments || '{}')
    return [
      {
        role: 'model',
        parts: [{ functionCall: { name: item.name, args } }],
      },
      {
        role: 'user',
        parts: [{ functionResponse: { name: item.name, response: { result: item.result || 'No result' } } }],
      },
    ]
  }

  private mapTool = (tool: IMindsetTool) => ({
    functionDeclarations: [{
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce(
          (acc, param) => ({ ...acc, [param.name]: { type: param.type, description: param.description } }),
          {}
        ),
        required: tool.parameters.map(param => param.name),
      },
    }],
  })

  private mapResponse(response: any): IChatAdapterNextItemRes {
    this.validateResponse(response)
    
    const part = response.response.candidates[0].content.parts[0]
    const chatItem: IChatItem = part.text 
      ? { type: 'botMessage', botMessage: { text: part.text } }
      : part.functionCall 
        ? {
            type: 'functionCall',
            functionCall: {
              id: `gemini_${Date.now()}`,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          }
        : (() => { throw new Error('Not supported Gemini Response') })()

    const usage: ILanguageModelUsage = {
      inputTokens: response.response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.response.usageMetadata?.candidatesTokenCount || 0,
    }

    if (!response.response.usageMetadata) {
      throw new Error('Unable to found usage info')
    }

    return { chatItem, usage }
  }

  private validateResponse(response: any): void {
    if (!response.response) {
      throw new Error('Invalid Gemini response structure')
    }
    if (!response.response.candidates?.[0]) {
      throw new Error('No candidates in Gemini response')
    }
    if (!response.response.candidates[0].content?.parts?.[0]) {
      throw new Error('No parts in Gemini response')
    }
  }
}