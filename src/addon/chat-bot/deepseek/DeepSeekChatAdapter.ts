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
import { OpenAI } from 'openai'

@chatAdapter({ provider: 'deepseek' })
@singleton()
export class DeepSeekChatAdapter implements IChatAdapter {
  private deepSeek: OpenAI
  private logger = new Logger('wabot:deepseek-chat-adapter')

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseURL = process.env.DEEPSEEK_BASE_URL

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY env variable is required')
    }
    if (!baseURL) {
      throw new Error('DEEPSEEK_BASE_URL env variable is required')
    }

    this.deepSeek = new OpenAI({
      apiKey,
      baseURL,
    })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const deepSeekInput: OpenAI.Chat.ChatCompletionMessageParam[] = []
    deepSeekInput.push({ role: 'system', content: req.systemPrompt })
    deepSeekInput.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    let lastError: unknown
    for (const ref of req.models) {
      try {
        const response = await this.deepSeek.chat.completions.create({
          model: ref.model,
          messages: deepSeekInput,
          tools,
          tool_choice: 'auto',
        })
        return this.mapResponse(response, ref.model)
      } catch (err) {
        if (!isRetryableError(err)) throw err
        this.logger.warn(
          `DeepSeek model '${ref.model}' failed with retryable error, trying next`,
          err instanceof Error ? { message: err.message } : { err },
        )
        lastError = err
      }
    }
    throw lastError ?? new Error('No DeepSeek model could handle the request')
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const deepSeekInput: OpenAI.Chat.ChatCompletionMessageParam[] = []

    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          deepSeekInput.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          deepSeekInput.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          deepSeekInput.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }

    return deepSeekInput
  }

  private mapHumanMessage(item: IChatMessage) {
    if (isChatMessageEmpty(item)) {
      throw new Error('User message content is empty')
    }
    return {
      role: 'user',
      content: extractChatMessageText(item, {
        supportedImageMimeTypes: [],
        supportedDocumentMimeTypes: [],
      }),
    } as const
  }

  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('Assistant message content is empty')
    }
    return { role: 'assistant', content: item.text } as const
  }

  private mapFunctionCall(item: IFunctionCall): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [
      {
        role: 'assistant',
        tool_calls: [
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
        tool_call_id: item.id,
        content: item.result ?? 'No result',
      },
    ]
  }

  private mapTool(tool: IMindsetTool) {
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
    } as const
  }

  private mapResponse(
    response: OpenAI.Chat.ChatCompletion,
    modelName: string,
  ): IChatAdapterNextItemsRes {
    let chatItem: IChatItem

    const { tool_calls: responseFunctionCall, content: responseText } =
      response.choices?.[0]?.message ?? {}

    if (responseText) {
      chatItem = { type: 'botMessage', botMessage: { text: responseText } }
    } else if (responseFunctionCall && responseFunctionCall[0]?.type === 'function') {
      chatItem = {
        type: 'functionCall',
        functionCall: {
          id: responseFunctionCall[0].id,
          name: responseFunctionCall[0].function.name,
          arguments: responseFunctionCall[0].function.arguments,
        },
      }
    } else {
      throw new Error('Not supported DeepSeek Response')
    }

    let usage: ILanguageModelUsage
    if (response.usage) {
      // DeepSeek exposes prompt_cache_hit_tokens (not in OpenAI SDK types)
      const cacheRead =
        (response.usage as unknown as { prompt_cache_hit_tokens?: number })
          .prompt_cache_hit_tokens ?? 0
      usage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        cacheReadTokens: cacheRead || undefined,
        provider: 'deepseek',
        model: response.model ?? modelName,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    return { nextItems: [chatItem], usage }
  }
}
