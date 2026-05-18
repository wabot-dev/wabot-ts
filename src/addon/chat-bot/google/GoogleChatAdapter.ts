import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Random } from '@/core/random'
import {
  chatAdapter,
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
  isRetryableError,
  safeJsonParse,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import {
  Content,
  FunctionDeclaration,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
} from '@google/genai'

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

@chatAdapter({ provider: 'google' })
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
    contents.push(...(await this.mapChatItems(req.prevItems)))

    const functionDeclarations = req.tools.map((x) => this.mapTool(x))

    const hasUnsignedFunctionCall = req.prevItems.some(
      (item) => item.type === 'functionCall' && !item.functionCall.signature,
    )

    let lastError: unknown
    for (const ref of req.models) {
      try {
        const response = await this.ai.models.generateContent({
          model: ref.model,
          contents,
          config: {
            tools: [{ functionDeclarations }],
            ...(hasUnsignedFunctionCall ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        })
        return this.mapResponse(response, ref.model)
      } catch (err) {
        if (!isRetryableError(err)) throw err
        this.logger.warn(
          `Google model '${ref.model}' failed with retryable error, trying next`,
          err instanceof Error ? { message: err.message } : { err },
        )
        lastError = err
      }
    }
    throw lastError ?? new Error('No Google model could handle the request')
  }

  private async mapChatItems(chatItems: IChatItem[]): Promise<Content[]> {
    const contents: Content[] = []
    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          contents.push(await this.mapHumanMessage(chatItem.humanMessage))
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

  private async mapHumanMessage(item: IChatMessage): Promise<Content> {
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
    const filesToSend: IChatMessageFile[] = []
    if (item.images) {
      for (const image of item.images) {
        if (!GOOGLE_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        filesToSend.push(image)
      }
    }
    if (item.documents) {
      for (const doc of item.documents) {
        if (!GOOGLE_SUPPORTED_DOCUMENT_MIME_TYPES.includes(doc.mimeType as never)) continue
        filesToSend.push(doc)
      }
    }
    const fileParts = await Promise.all(filesToSend.map((f) => this.toGoogleFilePart(f)))
    parts.push(...fileParts)
    return { role: 'user', parts }
  }

  private async toGoogleFilePart(file: IChatMessageFile): Promise<Part> {
    if (file.publicUrl) {
      if (isGoogleNativeFileUri(file.publicUrl)) {
        return { fileData: { fileUri: file.publicUrl, mimeType: file.mimeType } }
      }
      const data = await fetchAsBase64(file.publicUrl)
      return { inlineData: { data, mimeType: file.mimeType } }
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
    const callPart: Part = {
      functionCall: {
        id: item.id,
        name: item.name,
        args: safeJsonParse(item.arguments, 'function call arguments'),
      },
    }
    if (item.signature) {
      callPart.thoughtSignature = item.signature
    }
    return [
      {
        role: 'model',
        parts: [callPart],
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
          (prev, param) => ({ ...prev, [param.name]: param.schema }),
          {},
        ),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
        additionalProperties: false,
      },
    }
  }

  private mapResponse(
    response: GenerateContentResponse,
    modelName: string,
  ): IChatAdapterNextItemsRes {
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
            signature: part.thoughtSignature,
          },
        })
      }
    }

    const cachedTokens = response.usageMetadata.cachedContentTokenCount ?? 0
    let usage: ILanguageModelUsage = {
      inputTokens: response.usageMetadata.promptTokenCount,
      outputTokens: response.usageMetadata.candidatesTokenCount,
      cacheReadTokens: cachedTokens || undefined,
      provider: 'google',
      model: response.modelVersion ?? modelName,
    }

    return { usage, nextItems }
  }
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex >= 0 && dataUrl.startsWith('data:') ? dataUrl.slice(commaIndex + 1) : dataUrl
}

function isGoogleNativeFileUri(url: string): boolean {
  if (url.startsWith('gs://')) return true
  if (url.startsWith('https://generativelanguage.googleapis.com/')) return true
  return false
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch '${url}': ${res.status} ${res.statusText}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('base64')
}
