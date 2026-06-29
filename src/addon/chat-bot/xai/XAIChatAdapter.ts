import {
  chatAdapter,
  extractChatMessageText,
  IChatAdapter,
  IChatAdapterNextItemsReq,
  IChatAdapterNextItemsRes,
  IChatItem,
  IChatMessage,
  IChatMessageImage,
  IFunctionCall,
  ILanguageModelUsage,
  isChatMessageEmpty,
  isRetryableError,
} from '@/feature/chat-bot'
import { Logger } from '@/core/logger'
import { IMindsetTool } from '@/feature/mindset'
import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { OpenAI } from 'openai'

const XAI_SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

@chatAdapter({ provider: 'xai' })
@singleton()
export class XAIChatAdapter implements IChatAdapter {
  private logger = new Logger('wabot:xai-chat-adapter')
  private client: OpenAI

  constructor(private env: Env) {
    this.client = new OpenAI({
      apiKey: this.env.requireString('XAI_API_KEY'),
      baseURL: 'https://api.x.ai/v1',
    })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt })
    }
    messages.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((t) => this.mapTool(t))
    const chatTools = tools.length > 0 ? tools : undefined

    let lastError: unknown
    for (const ref of req.models) {
      try {
        const result = await this.client.chat.completions.create({
          model: ref.model,
          messages,
          tools: chatTools,
        })
        return this.mapResponse(result, ref.model)
      } catch (err) {
        if (!isRetryableError(err)) throw err
        this.logger.warn(
          `xAI model '${ref.model}' failed with retryable error, trying next`,
          err instanceof Error ? { message: err.message } : { err },
        )
        lastError = err
      }
    }
    throw lastError ?? new Error('No xAI model could handle the request')
  }

  private mapChatItems(items: IChatItem[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    for (const item of items) {
      switch (item.type) {
        case 'humanMessage':
          messages.push(this.mapHumanMessage(item.humanMessage))
          break
        case 'botMessage':
          messages.push(this.mapBotMessage(item.botMessage))
          break
        case 'functionCall':
          messages.push(...this.mapFunctionCall(item.functionCall))
          break
      }
    }
    return messages
  }

  private mapHumanMessage(msg: IChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (isChatMessageEmpty(msg)) {
      throw new Error('User message content is empty')
    }
    const content: OpenAI.Chat.ChatCompletionContentPart[] = []
    content.push({
      type: 'text',
      text: extractChatMessageText(msg, {
        supportedImageMimeTypes: XAI_SUPPORTED_IMAGE_MIME_TYPES,
      }),
    })
    if (msg.images) {
      for (const image of msg.images) {
        if (!XAI_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        content.push(this.mapImage(image))
      }
    }
    return { role: 'user', content } as OpenAI.Chat.ChatCompletionMessageParam
  }

  private mapImage(image: IChatMessageImage): OpenAI.Chat.ChatCompletionContentPart {
    const url = image.publicUrl ?? image.base64Url
    return { type: 'image_url', image_url: { url } }
  }

  private mapBotMessage(msg: IChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (!msg.text) throw new Error('Assistant message content is empty')
    return { role: 'assistant', content: msg.text }
  }

  private mapFunctionCall(fc: IFunctionCall): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: fc.id,
            type: 'function',
            function: { name: fc.name, arguments: fc.arguments || '{}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: fc.id,
        content: String(fc.result ?? 'No result'),
      },
    ]
  }

  private mapTool(tool: IMindsetTool): OpenAI.Chat.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce(
            (prev, param) => ({ ...prev, [param.name]: param.schema }),
            {},
          ),
          required: tool.parameters.filter((p) => p.required).map((p) => p.name),
          additionalProperties: false,
        },
      },
    }
  }

  private mapResponse(
    result: OpenAI.Chat.ChatCompletion,
    modelName: string,
  ): IChatAdapterNextItemsRes {
    const nextItems: IChatItem[] = []

    const choice = result.choices[0]
    const text = choice?.message.content?.trim()
    if (text) {
      nextItems.push({ type: 'botMessage', botMessage: { text } })
    }

    if (choice?.message.tool_calls?.length) {
      for (const call of choice.message.tool_calls) {
        if (call.type !== 'function') continue
        nextItems.push({
          type: 'functionCall',
          functionCall: {
            id: call.id ?? '',
            name: call.function.name,
            arguments: call.function.arguments,
          },
        })
      }
    }

    const usage: ILanguageModelUsage = {
      inputTokens: result.usage?.prompt_tokens ?? 0,
      outputTokens: result.usage?.completion_tokens ?? 0,
      provider: 'xai',
      model: result.model ?? modelName,
    }

    return { usage, nextItems }
  }
}
