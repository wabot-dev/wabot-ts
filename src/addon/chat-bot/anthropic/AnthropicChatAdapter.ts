import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import {
  chatAdapter,
  extractChatMessageText,
  IChatAdapter,
  IChatAdapterNextItemsReq,
  IChatAdapterNextItemsRes,
  IChatItem,
  IChatMessage,
  IChatMessageDocument,
  IChatMessageImage,
  IFunctionCall,
  ILanguageModelUsage,
  isChatMessageEmpty,
  isRetryableError,
  unconsumedMediaStartIndex,
  safeJsonParse,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import { Anthropic } from '@anthropic-ai/sdk'

const ANTHROPIC_SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const

const ANTHROPIC_SUPPORTED_DOCUMENT_MIME_TYPES = ['application/pdf', 'text/plain'] as const

@chatAdapter({ provider: 'anthropic' })
@singleton()
export class AnthropicChatAdapter implements IChatAdapter {
  private anthropic: Anthropic
  private logger = new Logger('wabot:anthropic-chat-adapter')

  constructor(private env: Env) {
    const apiKey = this.env.requireString('ANTHROPIC_API_KEY')
    this.anthropic = new Anthropic({ apiKey })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const tools = req.tools.map((x) => this.mapTool(x))
    const messages = this.mapChatItems(req.prevItems)

    let lastError: unknown
    for (const ref of req.models) {
      const request = {
        model: ref.model,
        max_tokens: 4096,
        system: req.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      }

      this.logger.debug(
        `Call Claude API with model: ${request.model}, messages: ${request.messages.length}, tools: ${request.tools?.length ?? 0}`,
      )

      try {
        const response = await this.anthropic.messages.create(request)
        return this.mapResponse(response, ref.model)
      } catch (err) {
        if (!isRetryableError(err)) throw err
        this.logger.warn(
          `Anthropic model '${ref.model}' failed with retryable error, trying next`,
          err instanceof Error ? { message: err.message } : { err },
        )
        lastError = err
      }
    }
    throw lastError ?? new Error('No Anthropic model could handle the request')
  }

  private mapChatItems(chatItems: IChatItem[]): Anthropic.Messages.MessageParam[] {
    const messages: Anthropic.Messages.MessageParam[] = []
    const mediaStart = unconsumedMediaStartIndex(chatItems)

    chatItems.forEach((chatItem, index) => {
      switch (chatItem.type) {
        case 'humanMessage':
          messages.push(this.mapHumanMessage(chatItem.humanMessage, index >= mediaStart))
          break
        case 'botMessage':
          messages.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          messages.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    })

    return messages
  }

  private mapHumanMessage(
    item: IChatMessage,
    includeMedia: boolean,
  ): Anthropic.Messages.MessageParam {
    if (isChatMessageEmpty(item)) {
      throw new Error('User message content is empty')
    }
    const blocks: Anthropic.Messages.ContentBlockParam[] = []
    blocks.push({
      type: 'text',
      text: extractChatMessageText(item, {
        supportedImageMimeTypes: ANTHROPIC_SUPPORTED_IMAGE_MIME_TYPES,
        supportedDocumentMimeTypes: ANTHROPIC_SUPPORTED_DOCUMENT_MIME_TYPES,
      }),
    })
    if (includeMedia && item.images) {
      for (const image of item.images) {
        if (!ANTHROPIC_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        blocks.push({ type: 'image', source: this.toAnthropicImageSource(image) })
      }
    }
    if (includeMedia && item.documents) {
      for (const doc of item.documents) {
        if (!ANTHROPIC_SUPPORTED_DOCUMENT_MIME_TYPES.includes(doc.mimeType as never)) continue
        blocks.push({ type: 'document', source: this.toAnthropicDocumentSource(doc) })
      }
    }
    return { role: 'user', content: blocks }
  }

  private toAnthropicImageSource(
    image: IChatMessageImage,
  ): Anthropic.Messages.ImageBlockParam['source'] {
    if (image.publicUrl) {
      return { type: 'url', url: image.publicUrl }
    }
    return {
      type: 'base64',
      media_type: image.mimeType as Anthropic.Messages.Base64ImageSource['media_type'],
      data: stripDataUrlPrefix(image.base64Url!),
    }
  }

  private toAnthropicDocumentSource(
    doc: IChatMessageDocument,
  ): Anthropic.Messages.DocumentBlockParam['source'] {
    if (doc.publicUrl) {
      return { type: 'url', url: doc.publicUrl }
    }
    if (doc.mimeType === 'text/plain') {
      return {
        type: 'text',
        media_type: 'text/plain',
        data: Buffer.from(stripDataUrlPrefix(doc.base64Url!), 'base64').toString('utf-8'),
      }
    }
    return {
      type: 'base64',
      media_type: 'application/pdf',
      data: stripDataUrlPrefix(doc.base64Url!),
    }
  }

  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('Assistant message content is empty')
    }
    return { role: 'assistant', content: extractChatMessageText(item) } as const
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
            input: safeJsonParse(item.arguments, 'function call arguments'),
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
          (prev, param) => ({ ...prev, [param.name]: param.schema }),
          {},
        ),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    }
  }

  private mapResponse(
    response: Anthropic.Messages.Message,
    modelName: string,
  ): IChatAdapterNextItemsRes {
    let usage: ILanguageModelUsage
    if (response.usage) {
      const cacheRead = response.usage.cache_read_input_tokens ?? 0
      const cacheWrite = response.usage.cache_creation_input_tokens ?? 0
      usage = {
        inputTokens: response.usage.input_tokens + cacheRead + cacheWrite,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: cacheRead || undefined,
        cacheWriteTokens: cacheWrite || undefined,
        provider: 'anthropic',
        model: response.model ?? modelName,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    const nextItems: IChatItem[] = []

    for (const content of response.content) {
      if (content.type === 'text' && content.text) {
        nextItems.push({ type: 'botMessage', botMessage: { text: content.text } })
      } else if (content.type === 'tool_use') {
        nextItems.push({
          type: 'functionCall',
          functionCall: {
            id: content.id,
            name: content.name,
            arguments: JSON.stringify(content.input),
          },
        })
      }
    }

    return { usage, nextItems }
  }
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex >= 0 && dataUrl.startsWith('data:') ? dataUrl.slice(commaIndex + 1) : dataUrl
}
