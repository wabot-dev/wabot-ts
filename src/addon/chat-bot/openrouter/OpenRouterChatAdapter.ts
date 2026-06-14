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
  IFunctionCall,
  ILanguageModelUsage,
  isChatMessageEmpty,
  isRetryableError,
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import { OpenRouter } from '@openrouter/sdk'
import type { ChatContentItems, ChatResult, ChatUserMessage } from '@openrouter/sdk/models'

const OPENROUTER_SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

const OPENROUTER_SUPPORTED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const

@chatAdapter({ provider: 'openrouter' })
@singleton()
export class OpenRouterChatAdapter implements IChatAdapter {
  private openRouter: OpenRouter
  private logger = new Logger('wabot:openrouter-chat-adapter')

  constructor(private env: Env) {
    const apiKey = this.env.requireString('OPENROUTER_API_KEY')
    this.openRouter = new OpenRouter({ apiKey })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const messages: Parameters<typeof this.openRouter.chat.send>[0]['chatRequest']['messages'] = []
    messages.push({ role: 'system', content: req.systemPrompt })
    messages.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    const modelNames = req.models.map((m) => m.model)
    const [primary, ...fallbacks] = modelNames

    const userMessageSummary = messages
      .filter((m) => m.role === 'user')
      .map((m) => {
        const content = m.content
        if (Array.isArray(content)) {
          const parts = content.map((p) => {
            if (p.type === 'text') return `text(${p.text.length}ch)`
            if (p.type === 'image_url') return `image_url`
            if (p.type === 'file') return `file(${p.file.filename})`
            return p.type
          })
          return `[${parts.join(', ')}]`
        }
        return `[text]`
      })

    this.logger.debug(
      `Call OpenRouter with model: ${primary}, fallbacks: ${fallbacks.length}, messages: ${messages.length}, tools: ${tools.length}, user parts: ${userMessageSummary.join(' | ')}`,
    )

    const maxAttempts = 3
    const backoffMs = [500, 1000, 2000]
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.openRouter.chat.send({
          chatRequest: {
            model: primary,
            models: fallbacks.length > 0 ? fallbacks : undefined,
            messages,
            tools: tools.length > 0 ? tools : undefined,
          },
        })
        return this.mapResponse(response)
      } catch (err) {
        if (attempt === maxAttempts || !isRetryableError(err)) throw err
        const message = err instanceof Error ? err.message : String(err)
        this.logger.warn(
          `OpenRouter call failed (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs[attempt - 1]}ms: ${message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1]))
      }
    }
    throw new Error('OpenRouter retry loop exited without result')
  }

  private mapChatItems(
    chatItems: IChatItem[],
  ): Parameters<typeof this.openRouter.chat.send>[0]['chatRequest']['messages'] {
    const messages: Parameters<typeof this.openRouter.chat.send>[0]['chatRequest']['messages'] = []
    chatItems.forEach((chatItem) => {
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
    })

    return messages
  }

  private mapHumanMessage(item: IChatMessage): ChatUserMessage {
    if (isChatMessageEmpty(item)) {
      throw new Error('User message content is empty')
    }
    const contentParts: ChatContentItems[] = []
    contentParts.push({
      type: 'text',
      text: extractChatMessageText(item, {
        supportedImageMimeTypes: OPENROUTER_SUPPORTED_IMAGE_MIME_TYPES,
        supportedDocumentMimeTypes: OPENROUTER_SUPPORTED_DOCUMENT_MIME_TYPES,
      }),
    })
    if (item.images) {
      for (const image of item.images) {
        if (!OPENROUTER_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        const imageUrl = image.publicUrl ?? image.base64Url
        if (imageUrl) contentParts.push({ type: 'image_url', imageUrl: { url: imageUrl } })
      }
    }
    if (item.documents) {
      for (const doc of item.documents) {
        if (!OPENROUTER_SUPPORTED_DOCUMENT_MIME_TYPES.includes(doc.mimeType as never)) continue
        const docUrl = doc.publicUrl ?? doc.base64Url
        if (docUrl) {
          contentParts.push({ type: 'file', file: { fileData: docUrl, filename: doc.name } })
        }
      }
    }
    return { role: 'user', content: contentParts }
  }

  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('Assistant message content is empty')
    }
    return { role: 'assistant', content: item.text } as const
  }

  private mapFunctionCall(
    item: IFunctionCall,
  ): Parameters<typeof this.openRouter.chat.send>[0]['chatRequest']['messages'] {
    return [
      {
        role: 'assistant',
        toolCalls: [
          {
            id: item.id,
            type: 'function',
            function: {
              name: item.name,
              arguments: item.arguments || '{}',
            },
          },
        ],
      },
      {
        role: 'tool',
        toolCallId: item.id,
        content: item.result ?? 'No result',
      },
    ]
  }

  private mapTool(tool: IMindsetTool) {
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce(
            (prev, param) => ({ ...prev, [param.name]: param.schema }),
            {} as Record<string, unknown>,
          ),
          required: tool.parameters.filter((p) => p.required).map((p) => p.name),
          additionalProperties: false,
        },
      },
    }
  }

  private mapResponse(response: ChatResult): IChatAdapterNextItemsRes {
    const choice = response.choices?.[0]
    const message = choice?.message
    const finishReason = choice?.finishReason ?? null
    const responseText = typeof message?.content === 'string' ? message.content : undefined
    const responseToolCalls = message?.toolCalls
    const refusal = message?.refusal

    const nextItems: IChatItem[] = []

    if (responseText) {
      nextItems.push({ type: 'botMessage', botMessage: { text: responseText } })
    }

    if (responseToolCalls && responseToolCalls.length > 0) {
      for (const toolCall of responseToolCalls) {
        if (toolCall.type === 'function') {
          nextItems.push({
            type: 'functionCall',
            functionCall: {
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          })
        }
      }
    }

    if (nextItems.length === 0) {
      const diagnostics = {
        model: response.model,
        finishReason,
        hasChoices: (response.choices?.length ?? 0) > 0,
        hasMessage: !!message,
        contentType: message?.content === undefined ? 'undefined' : typeof message.content,
        hasReasoning: !!message?.reasoning,
        refusal: refusal ?? null,
        toolCallsCount: responseToolCalls?.length ?? 0,
      }
      this.logger.warn(`Empty OpenRouter response: ${JSON.stringify(diagnostics)}`)
      throw new Error(
        `Empty OpenRouter response (model: ${response.model}, finishReason: ${finishReason ?? 'null'}${refusal ? ', refused' : ''})`,
      )
    }

    let usage: ILanguageModelUsage
    if (response.usage) {
      const cacheRead = response.usage.promptTokensDetails?.cachedTokens ?? 0
      const cacheWrite = response.usage.promptTokensDetails?.cacheWriteTokens ?? 0
      // OpenRouter exposes `cost` (and provider) on the response but the SDK
      // types haven't surfaced them yet — read via cast.
      const costUsd = (response.usage as unknown as { cost?: number }).cost
      const upstreamProvider = (response as unknown as { provider?: string }).provider
      usage = {
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        cacheReadTokens: cacheRead || undefined,
        cacheWriteTokens: cacheWrite || undefined,
        costUsd: typeof costUsd === 'number' ? costUsd : undefined,
        provider: upstreamProvider ? `openrouter/${upstreamProvider}` : 'openrouter',
        model: response.model,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    return { nextItems, usage }
  }
}
