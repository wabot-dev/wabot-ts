import {
  chatAdapter,
  IChatAdapter,
  IChatAdapterNextItemsReq,
  IFunctionCall,
  IChatItem,
  IChatMessage,
  IChatAdapterNextItemsRes,
  ILanguageModelUsage,
  extractChatMessageText,
  isChatMessageEmpty,
  isRetryableError,
  unconsumedMediaStartIndex,
} from '@/feature/chat-bot'
import { Logger } from '@/core/logger'
import { OpenAI } from 'openai'
import { IMindsetTool } from '@/feature/mindset'
import { singleton } from '@/core/injection'

const OPENAI_SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

const OPENAI_SUPPORTED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const

@chatAdapter({ provider: 'openai' })
@singleton()
export class OpenaiChatAdapter implements IChatAdapter {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-chat-adapter')

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    openIaInput.push({ role: 'system', content: req.systemPrompt })
    openIaInput.push(...this.mapChatItems(req.prevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    let lastError: unknown
    for (const ref of req.models) {
      try {
        const response = await this.openai.responses.create({
          model: ref.model,
          input: openIaInput,
          tools,
        })
        return this.mapResponse(response, ref.model)
      } catch (err) {
        if (!isRetryableError(err)) throw err
        this.logger.warn(
          `OpenAI model '${ref.model}' failed with retryable error, trying next`,
          err instanceof Error ? { message: err.message } : { err },
        )
        lastError = err
      }
    }
    throw lastError ?? new Error('No OpenAI model could handle the request')
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    const mediaStart = unconsumedMediaStartIndex(chatItems)
    chatItems.forEach((chatItem, index) => {
      switch (chatItem.type) {
        case 'humanMessage':
          openIaInput.push(this.mapConectionMessage(chatItem.humanMessage, index >= mediaStart))
          break
        case 'botMessage':
          openIaInput.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          openIaInput.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    })
    return openIaInput
  }

  private mapConectionMessage(item: IChatMessage, includeMedia: boolean) {
    if (isChatMessageEmpty(item)) {
      throw new Error('User message content is empty')
    }
    const content: OpenAI.Responses.ResponseInputContent[] = []
    content.push({
      type: 'input_text',
      text: extractChatMessageText(item, {
        supportedImageMimeTypes: OPENAI_SUPPORTED_IMAGE_MIME_TYPES,
        supportedDocumentMimeTypes: OPENAI_SUPPORTED_DOCUMENT_MIME_TYPES,
      }),
    })
    if (includeMedia && item.images) {
      for (const image of item.images) {
        if (!OPENAI_SUPPORTED_IMAGE_MIME_TYPES.includes(image.mimeType as never)) continue
        content.push({
          type: 'input_image',
          image_url: image.publicUrl ?? image.base64Url,
          detail: 'auto',
        })
      }
    }
    if (includeMedia && item.documents) {
      for (const doc of item.documents) {
        if (!OPENAI_SUPPORTED_DOCUMENT_MIME_TYPES.includes(doc.mimeType as never)) continue
        if (doc.publicUrl) {
          content.push({ type: 'input_file', file_url: doc.publicUrl })
        } else {
          content.push({
            type: 'input_file',
            file_data: doc.base64Url,
            filename: doc.name ?? `${doc.id}.pdf`,
          })
        }
      }
    }
    return { role: 'user', content } as const
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
    const allRequired = tool.parameters.every((p) => p.required)
    return {
      type: 'function',
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
      strict: allRequired,
    } as const
  }

  private mapResponse(
    response: OpenAI.Responses.Response,
    modelName: string,
  ): IChatAdapterNextItemsRes {
    let usage: ILanguageModelUsage
    if (response.usage) {
      const cacheRead = response.usage.input_tokens_details?.cached_tokens ?? 0
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: cacheRead || undefined,
        provider: 'openai',
        model: response.model ?? modelName,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    const nextItems: IChatItem[] = []

    for (const output of response.output) {
      if (output.type === 'message') {
        for (const content of output.content) {
          if (content.type === 'output_text' && content.text) {
            nextItems.push({ type: 'botMessage', botMessage: { text: content.text } })
          }
        }
      } else if (output.type === 'function_call') {
        nextItems.push({
          type: 'functionCall',
          functionCall: { id: output.call_id, name: output.name, arguments: output.arguments },
        })
      }
    }

    return { usage, nextItems }

    // let chatItem: IChatItem
    // if (response.output_text) {
    //   chatItem = { type: 'botMessage', botMessage: { text: response.output_text } }
    // } else if (response.output && response.output[0]?.type == 'function_call') {
    //   chatItem = {
    //     type: 'functionCall',
    //     functionCall: {
    //       id: response.output[0].call_id,
    //       name: response.output[0].name,
    //       arguments: response.output[0].arguments,
    //     },
    //   }
    // } else {
    //   throw new Error('Not supported OpenIA Response')
    // }

    // let usage: ILanguageModelUsage
    // if (response.usage) {
    //   usage = {
    //     inputTokens: response.usage.input_tokens,
    //     outputTokens: response.usage.output_tokens,
    //   }
    // } else {
    //   throw new Error('Unable to found usage info')
    // }
    // return { chatItem, usage }
  }
}
