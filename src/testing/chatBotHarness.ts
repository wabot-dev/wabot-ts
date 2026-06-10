import { Auth } from '@/core/auth'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import {
  ChatAdapter,
  ChatBot,
  ChatMemory,
  IChatAdapter,
  IChatItemData,
  IChatMessage,
  IFunctionCall,
} from '@/feature/chat-bot'
import { IMindset, IMindsetTool, Mindset, MindsetOperator } from '@/feature/mindset'

import { humanMessage } from './fixtures'
import { MockChatAdapter } from './MockChatAdapter'
import { TestChatMemory } from './TestChatMemory'

export interface IChatBotHarnessOptions<A extends IChatAdapter> {
  mindset: IConstructor<IMindset>
  /** LLM adapter; defaults to a fresh MockChatAdapter. */
  adapter?: A
  /** Extra DI registrations for the mindset module dependencies: [token, instance]. */
  register?: [any, any][]
  /** Assigned to the container-scoped Auth, like production does per message. */
  authInfo?: object
}

export interface IChatBotTurn {
  /** Bot messages delivered through the reply callback during this turn. */
  replies: IChatMessage[]
  /** Tool calls executed during this turn, with their results. */
  toolCalls: IFunctionCall[]
  /** Every chat item created during this turn (human, bot and tool calls). */
  items: IChatItemData[]
}

/**
 * Runs a real ChatBot (real MindsetOperator, system prompt, tool loop and
 * argument validation) against an in-RAM memory and a pluggable adapter.
 */
export class ChatBotHarness<A extends IChatAdapter = MockChatAdapter> {
  readonly adapter: A
  readonly memory = new TestChatMemory()
  readonly container: DependencyContainer

  private chatBot: ChatBot
  private operator: MindsetOperator

  constructor(options: IChatBotHarnessOptions<A>) {
    this.adapter = options.adapter ?? (new MockChatAdapter() as IChatAdapter as A)

    const child = container.createChildContainer()
    child.register(Container, { useValue: child })
    child.register(Mindset, { useClass: options.mindset })
    child.registerInstance(ChatMemory, this.memory as unknown as ChatMemory)
    child.registerInstance(ChatAdapter, this.adapter as unknown as ChatAdapter)

    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }

    if (options.authInfo) {
      const auth = child.resolve(Auth) as Auth<object>
      auth.assign(options.authInfo)
    }

    this.container = child
    this.chatBot = child.resolve(ChatBot)
    this.operator = child.resolve(MindsetOperator)
  }

  /** Send a human message and collect everything the bot did in response. */
  async send(message: string | IChatMessage): Promise<IChatBotTurn> {
    const itemsBefore = this.memory.all().length
    const replies: IChatMessage[] = []

    await this.chatBot.sendMessage(humanMessage(message), async (reply) => {
      replies.push(reply)
    })

    const items = this.memory.allData().slice(itemsBefore)
    const toolCalls = items
      .filter((item) => item.type === 'functionCall')
      .map((item) => item.functionCall as IFunctionCall)

    return { replies, toolCalls, items }
  }

  /**
   * Execute a single mindset tool directly (real argument validation and
   * module resolution), without scripting a whole conversation.
   * Returns the string result exactly as the LLM would receive it.
   */
  async callTool(name: string, args: object | string = {}): Promise<string> {
    const argsJson = typeof args === 'string' ? args : JSON.stringify(args)
    return await this.operator.callFunction(name, argsJson)
  }

  /** Full chat history (data form) accumulated across turns. */
  history(): IChatItemData[] {
    return this.memory.allData()
  }

  /** The real system prompt the mindset produces. */
  async systemPrompt(): Promise<string> {
    return await this.operator.systemPrompt()
  }

  /** The real tool definitions derived from the mindset modules. */
  tools(): IMindsetTool[] {
    return this.operator.tools()
  }
}

export function createChatBotHarness<A extends IChatAdapter = MockChatAdapter>(
  options: IChatBotHarnessOptions<A>,
): ChatBotHarness<A> {
  return new ChatBotHarness(options)
}
