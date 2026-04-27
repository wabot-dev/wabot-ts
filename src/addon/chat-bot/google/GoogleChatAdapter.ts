import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Random } from '@/core/random'
import {
  extractChatMessageText,
  IChatAdapter,
  IChatAdapterNextItemsReq,
  IChatAdapterNextItemsRes,
  IChatItem,
  IChatMessage,
  IChatMessageFile,
  IFunctionCall,
  ILanguageModelUsage,
  isChatMessageEmpty,
  safeJsonParse,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import { Content, FunctionDeclaration, GenerateContentResponse, GoogleGenAI, Part } from '@google/genai'

const GOOGLE_SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

const GOOGLE_SUPPORTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/html',
  'text/markdown',
  'text/xml',
  'text/rtf',
  'application/json',
] as const

export interface GoogleChatAdapterV2Options {
  apiKey?: string
}

@singleton()
export class GoogleChatAdapter implements IChatAdapter {
  private ai: GoogleGenAI
  private readonly logger = new Logger('wabot:google-chat-adapter-v2')

  constructor(env: Env) {
    this.ai = new GoogleGenAI({ apiKey: env.requireString('GOOGLE_API_KEY') })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const contents: Content[] = []
    contents.push({ role: 'user', parts: [{ text: req.systemPrompt }] })
    contents.push(...this.mapChatItems(req.prevItems))

    const functionDeclarations = req.tools.map((x) => this.mapTool(x))

    const response = await this.ai.models.generateContent({
      model: req.model,
      contents,
      config: { tools: [{ functionDeclarations }] },
    })

    return this.mapResponse(response)
  }

  private mapChatItems(chatItems: IChatItem[]): Content[] {
    const contents: Content[] = []
    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          contents.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          contents.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          contents.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }
    return contents
  }

  private mapHumanMessage(item: IChatMessage): Content {
    if (isChatMessageEmpty(item)) {
      throw new Error('User message content is empty')
    }
    const parts: Part[] = []
    parts.push({
      text: extractChatMessageText(item, {
        supportedImageMimeTypes: GOOGLE_SUPPORTED_IMAGE_MIME_TYPES,
        supportedDocumentMimeTypes: GOOGLE_SUPPORTED_DOCUMENT_MIME_TYPES,
      }),
    })
    if (item.images) {
      for (const image of item.images) {
        if (!GOOGLE_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        parts.push(this.toGoogleFilePart(image))
      }
    }
    if (item.documents) {
      for (const doc of item.documents) {
        if (!GOOGLE_SUPPORTED_DOCUMENT_MIME_TYPES.includes(doc.mimeType as never)) continue
        parts.push(this.toGoogleFilePart(doc))
      }
    }
    return { role: 'user', parts }
  }

  private toGoogleFilePart(file: IChatMessageFile): Part {
    if (file.publicUrl) {
      return { fileData: { fileUri: file.publicUrl, mimeType: file.mimeType } }
    }
    return {
      inlineData: { data: stripDataUrlPrefix(file.base64Url!), mimeType: file.mimeType },
    }
  }

  private mapBotMessage(item: IChatMessage): Content {
    if (!item.text) {
      throw new Error('Bot message content is empty')
    }
    return { role: 'model', parts: [{ text: extractChatMessageText(item) }] }
  }

  private mapFunctionCall(item: IFunctionCall): Content[] {
    return [
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              id: item.id,
              name: item.name,
              args: safeJsonParse(item.arguments, 'function call arguments'),
            },
          },
        ],
      },
      {
        role: 'function',
        parts: [
          {
            functionResponse: {
              id: item.id,
              name: item.name,
              response: { output: item.result ?? '' },
            },
          },
        ],
      },
    ]
  }

  private mapTool(tool: IMindsetTool): FunctionDeclaration {
    return {
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: {
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
    }
  }

  private mapResponse(response: GenerateContentResponse): IChatAdapterNextItemsRes {
    if (!response.candidates || !response.candidates.length) {
      throw new Error('No candidates in response')
    }

    if (
      !response.usageMetadata ||
      !response.usageMetadata.promptTokenCount ||
      !response.usageMetadata.candidatesTokenCount
    ) {
      throw new Error('Not usage metadata')
    }

    const content = response.candidates.find((x) => x.content)?.content
    if (!content) {
      throw new Error('Candidates has no content')
    }

    const nextItems: IChatItem[] = []

    for (const part of content.parts ?? []) {
      if (part.text) {
        nextItems.push({ type: 'botMessage', botMessage: { text: part.text } })
      }
      if (part.functionCall) {
        const { id, name, args } = part.functionCall
        if (!name) {
          throw new Error('invalid function call')
        }
        nextItems.push({
          type: 'functionCall',
          functionCall: {
            id: id ?? Random.alphaNumericLowerCase(10),
            name,
            arguments: args && JSON.stringify(args),
          },
        })
      }
    }

    let usage: ILanguageModelUsage = {
      inputTokens: response.usageMetadata.promptTokenCount,
      outputTokens: response.usageMetadata.candidatesTokenCount,
    }

    return { usage, nextItems }
  }
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex >= 0 && dataUrl.startsWith('data:') ? dataUrl.slice(commaIndex + 1) : dataUrl
}
