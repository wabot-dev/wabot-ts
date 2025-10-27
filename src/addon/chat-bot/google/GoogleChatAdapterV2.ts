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
import { IMindsetTool } from '@/feature/mindset'
import { GoogleGenAI } from '@google/genai'

export interface GoogleChatAdapterV2Options {
  apiKey?: string
  model?: string
  timeoutMs?: number
}

@singleton()
export class GoogleChatAdapterV2 implements IChatAdapter {
  private client: GoogleGenAI
  private readonly logger = new Logger('wabot:google-chat-adapter-v2')
  private readonly defaultModel: string
  private readonly timeoutMs: number

  constructor(private env: Env, options: GoogleChatAdapterV2Options = {}) {
    const apiKey = options.apiKey ?? this.env.requireString('GOOGLE_API_KEY')
    this.defaultModel = options.model ?? 'gemini-2.5-flash'
    this.timeoutMs = options.timeoutMs ?? 30000

    // Cliente de Google GenAI: GoogleGenAI
    this.client =  new GoogleGenAI({ apiKey })
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const input = this.mapChatItems(req.prevItems)
    const tools = req.tools.map((x) => this.mapTool(x))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await (this.client as any).responses.generate({
        model: req.model || this.defaultModel,
        input: [{ role: 'system', content: req.systemPrompt }, ...input],
        tools,
        signal: controller.signal,
      })

      return this.mapResponse(response)
    } catch (err) {
      this.logger.error('Google GenAI request failed', err instanceof Error ? err : undefined)
      throw err instanceof Error ? err : new Error(String(err))
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Envía un único mensaje de texto y obtiene la respuesta.
   */
  async sendMessage(text: string, options?: { model?: string; tools?: IMindsetTool[] }): Promise<IChatAdapterNextItemsRes> {
    const req: IChatAdapterNextItemsReq = {
      model: options?.model ?? this.defaultModel,
      systemPrompt: 'You are a helpful assistant. Keep responses brief.',
      tools: options?.tools ?? [],
      prevItems: [
        { type: 'humanMessage', humanMessage: { text, senderId: 'user', senderName: 'User' } },
      ],
    }
    return this.nextItems(req)
  }

  /**
   * Streaming de respuesta. Devuelve un AsyncGenerator que emite `IChatItem` conforme llegan los chunks.
   */
  async *sendMessageStream(text: string, options?: { model?: string; tools?: IMindsetTool[] }) {
    const tools = (options?.tools ?? []).map((x) => this.mapTool(x))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const stream = await (this.client as any).responses.streamGenerate({
        model: options?.model ?? this.defaultModel,
        input: [{ role: 'user', content: text }],
        tools,
        signal: controller.signal,
      })

      // Adoptamos un protocolo de iteración básico: cada chunk con texto se emite como botMessage.
      for await (const chunk of stream) {
        const items = this.tryMapStreamChunkToItems(chunk)
        for (const item of items) {
          yield item
        }
      }
    } catch (err) {
      this.logger.error('Google GenAI stream failed', err instanceof Error ? err : undefined)
      throw err instanceof Error ? err : new Error(String(err))
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Mapea los items del historial de chat al formato de Responses API.
   */
  private mapChatItems(chatItems: IChatItem[]): any[] {
    const input: any[] = []
    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          input.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          input.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          input.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }
    return input
  }

  /**
   * Valida y compone el mensaje de usuario.
   */
  private mapHumanMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('System message content is empty')
    }
    return { role: 'user', content: item.text } as const
  }

  /**
   * Valida y compone el mensaje del asistente.
   */
  private mapBotMessage(item: IChatMessage) {
    if (!item.text) {
      throw new Error('System message content is empty')
    }
    return { role: 'assistant', content: item.text } as const
  }

  /**
   * Mapea llamadas a función al formato Responses API (estilo OpenAI adapter).
   */
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

  /**
   * Define herramientas usando JSON Schema (estricto), similar al OpenaiChatAdapter.
   */
  private mapTool(tool: IMindsetTool) {
    return {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: {
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
      strict: true,
    } as const
  }

  /**
   * Traduce la respuesta de Responses API a `{ usage, nextItems }`.
   */
  private mapResponse(response: any): IChatAdapterNextItemsRes {
    let usage: ILanguageModelUsage
    if (response.usage) {
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    const nextItems: IChatItem[] = []

    for (const output of response.output ?? []) {
      if (output.type === 'message') {
        for (const content of output.content ?? []) {
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
  }

  /**
   * Intenta traducir un chunk del stream a items de salida.
   */
  private tryMapStreamChunkToItems(chunk: any): IChatItem[] {
    const items: IChatItem[] = []
    // Asumimos que el chunk tiene estructura similar a `output.message.content[..].output_text`.
    if (chunk && chunk.type === 'message') {
      for (const content of chunk.content ?? []) {
        if (content.type === 'output_text' && content.text) {
          items.push({ type: 'botMessage', botMessage: { text: content.text } })
        }
      }
    }
    return items
  }
}