import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import {
  IChatAdapter,
  IChatAdapterNextItemsReq,
  IChatAdapterNextItemsRes,
  IChatItem,
  IChatMessage,
  IFunctionCall,
  ILanguageModelUsage,
} from '@/feature/chat-bot'
import { GoogleGenAI } from '@google/genai'

export interface GoogleChatAdapterV2Options {
  apiKey?: string
}

@singleton()
export class GoogleChatAdapterV2 implements IChatAdapter {
  private ai: GoogleGenAI
  private readonly logger = new Logger('wabot:google-chat-adapter-v2')  
  private readonly defaultModel: string
  private readonly timeoutMs: number
  private readonly maxHistoryItems: number


  constructor(private env: Env) {

    this.ai = new GoogleGenAI({})
    this.defaultModel = this.env.requireString('GOOGLE_MODEL', { default: 'gemini-2.5-flash' })
    this.timeoutMs = this.env.requireNumber('GOOGLE_TIMEOUT_MS', { default: 30000 })
    this.maxHistoryItems = this.env.requireNumber('GOOGLE_MAX_HISTORY_ITEMS', { default: 32 })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const contents = this.buildContents(req.systemPrompt, req.prevItems)

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Google GenAI request timeout')), this.timeoutMs),
    )

    try {
      const response = await Promise.race([
        this.ai.models.generateContent({ model: req.model ?? this.defaultModel, contents }),
        timeoutPromise,
      ])

      return this.mapResponse(response)
    } catch (err) {
      this.logger.error('Google GenAI request failed', err instanceof Error ? err : undefined)
      throw err instanceof Error ? err : new Error(String(err))
    } finally {
     
    }
  }

  private buildContents(systemPrompt: string, chatItems: IChatItem[]): any[] {
    const contents: any[] = []
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] })
    }

    const tail = chatItems.slice(Math.max(0, chatItems.length - this.maxHistoryItems))
    for (const chatItem of tail) {
      switch (chatItem.type) {
        case 'humanMessage':
          contents.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          contents.push(this.mapBotMessage(chatItem.botMessage))
          break
      }
    }
    return contents
  }

 
  private mapHumanMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('User message content is empty')
    }
    return { role: 'user', parts: [{ text: item.text }] } as const
  }


  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('Bot message content is empty')
    }
    return { role: 'model', parts: [{ text: item.text }] } as const
  }

  async *sendMessageStream(text: string, options?: { model?: string }) {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Google GenAI stream timeout')), this.timeoutMs),
    )
    try {
      const response: AsyncIterable<any> = (await Promise.race([
        this.ai.models.generateContentStream({
          model: options?.model ?? this.defaultModel,
          contents: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
        }),
        timeoutPromise,
      ])) as any
      for await (const chunk of response) {
        if (chunk && typeof (chunk as any).text === 'string' && (chunk as any).text.length > 0) {
          yield { type: 'botMessage', botMessage: { text: (chunk as any).text } } as IChatItem
        }
      }
    } catch (err) {
      this.logger.error('Google GenAI stream failed', err instanceof Error ? err : undefined)
      throw err instanceof Error ? err : new Error(String(err))
    } finally {
      
    }
  }
 
  private mapResponse(response: any): IChatAdapterNextItemsRes {
    const nextItems: IChatItem[] = []

    const text = response?.text
    if (typeof text === 'string' && text.length > 0) {
      nextItems.push({ type: 'botMessage', botMessage: { text } })
    } else {
      const parts = response?.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.length > 0) {
          nextItems.push({ type: 'botMessage', botMessage: { text: part.text } })
        }
      }
    }

    let usage: ILanguageModelUsage = { inputTokens: 0, outputTokens: 0 }
    const meta = response?.usageMetadata
    if (meta) {
      usage = {
        inputTokens: Number(meta.promptTokenCount ?? 0),
        outputTokens: Number(meta.candidatesTokenCount ?? 0),
      }
    } else if (response?.usage) {
      usage = {
        inputTokens: Number(response.usage.input_tokens ?? 0),
        outputTokens: Number(response.usage.output_tokens ?? 0),
      }
    }

    if (nextItems.length === 0) {
      this.logger.trace('Empty response mapping from Google GenAI', response)
    }

    return { usage, nextItems }
  }

 
}