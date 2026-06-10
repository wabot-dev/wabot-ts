import {
  IChatAdapter,
  IChatAdapterNextItemsReq,
  IChatAdapterNextItemsRes,
  IChatItem,
} from '@/feature/chat-bot'

export type IMockChatAdapterResponse =
  | IChatItem[]
  | ((req: IChatAdapterNextItemsReq) => IChatItem[] | Promise<IChatItem[]>)

export interface IMockChatAdapterOptions {
  /**
   * When the scripted queue is empty, answer with this text instead of
   * throwing. Useful for tests that don't care about every bot reply.
   */
  fallbackReply?: string
}

/**
 * Deterministic IChatAdapter for tests: script the LLM turns with
 * reply()/callTool()/enqueue() and assert on the recorded requests.
 * Each queued response is consumed by one nextItems() call, so a tool
 * call turn must be followed by another scripted turn (the ChatBot loop
 * calls the adapter again after executing the tool).
 */
export class MockChatAdapter implements IChatAdapter {
  readonly requests: IChatAdapterNextItemsReq[] = []
  private queue: IMockChatAdapterResponse[] = []
  private callIdCounter = 0

  constructor(private options: IMockChatAdapterOptions = {}) {}

  /** Queue a turn where the bot answers with a plain text message. */
  reply(text: string): this {
    return this.enqueue([{ type: 'botMessage', botMessage: { text } }])
  }

  /** Queue a turn where the bot requests a tool call (executed for real by the ChatBot). */
  callTool(name: string, args?: object | string): this {
    return this.enqueue([
      {
        type: 'functionCall',
        functionCall: {
          id: `mock-call-${++this.callIdCounter}`,
          name,
          arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
        },
      },
    ])
  }

  /** Queue a raw turn: a list of chat items, or a function of the request. */
  enqueue(response: IMockChatAdapterResponse): this {
    this.queue.push(response)
    return this
  }

  get lastRequest(): IChatAdapterNextItemsReq | undefined {
    return this.requests[this.requests.length - 1]
  }

  pendingResponses(): number {
    return this.queue.length
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    this.requests.push(req)
    let response = this.queue.shift()
    if (!response) {
      if (this.options.fallbackReply === undefined) {
        throw new Error(
          'MockChatAdapter: no scripted response left for this turn. ' +
            'Queue one with reply()/callTool()/enqueue(), or set the fallbackReply option. ' +
            'Remember that after a callTool() turn the ChatBot calls the adapter again.',
        )
      }
      response = [{ type: 'botMessage', botMessage: { text: this.options.fallbackReply } }]
    }
    const nextItems = typeof response === 'function' ? await response(req) : response
    return {
      nextItems,
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        provider: 'mock',
        model: req.models[0]?.model ?? 'mock-model',
      },
    }
  }
}
