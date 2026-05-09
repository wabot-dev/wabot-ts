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
} from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import { OpenRouter } from '@openrouter/sdk'
import type { ChatResult } from '@openrouter/sdk/models'

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

    this.logger.debug(
      `Call OpenRouter with model: ${primary}, fallbacks: ${fallbacks.length}, messages: ${messages.length}, tools: ${tools.length}`,
    )

    const response = await this.openRouter.chat.send({
      chatRequest: {
        model: primary,
        models: fallbacks.length > 0 ? fallbacks : undefined,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      },
    })

    return this.mapResponse(response)
  }

  private mapChatItems(
    chatItems: IChatItem[],
  ): Parameters<typeof this.openRouter.chat.send>[0]['chatRequest']['messages'] {
    const messages: Parameters<typeof this.openRouter.chat.send>[0]['chatRequest']['messages'] = []

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
    if (isChatMessageEmpty(item)) {
      throw new Error('User message content is empty')
    }
    const contentParts: string[] = []
    contentParts.push(
      extractChatMessageText(item, {
        supportedImageMimeTypes: OPENROUTER_SUPPORTED_IMAGE_MIME_TYPES,
        supportedDocumentMimeTypes: OPENROUTER_SUPPORTED_DOCUMENT_MIME_TYPES,
      }),
    )
    if (item.images) {
      for (const image of item.images) {
        if (!OPENROUTER_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        const imageUrl = image.publicUrl ?? image.base64Url
        if (imageUrl) contentParts.push(imageUrl)
      }
    }
    if (item.documents) {
      for (const doc of item.documents) {
        if (!OPENROUTER_SUPPORTED_DOCUMENT_MIME_TYPES.includes(doc.mimeType as never)) continue
        const docUrl = doc.publicUrl ?? doc.base64Url
        if (docUrl) contentParts.push(docUrl)
      }
    }
    return { role: 'user', content: contentParts.join('\n') } as const
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
            (prev, param) => ({
              ...prev,
              [param.name]: { type: param.type, description: param.description },
            }),
            {} as Record<string, { type: string; description: string }>,
          ),
          required: tool.parameters.map((param) => param.name),
          additionalProperties: false,
        },
        strict: true,
      },
    }
  }

  private mapResponse(response: ChatResult): IChatAdapterNextItemsRes {
    const { toolCalls: responseToolCalls, content: responseText } =
      response.choices?.[0]?.message ?? {}

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
      throw new Error('Not supported OpenRouter Response')
    }

    let usage: ILanguageModelUsage
    if (response.usage) {
      usage = {
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    return { nextItems, usage }
  }
}
