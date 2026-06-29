import { InMemoryLocker } from '@/addon/lock'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { Locker } from '@/core/lock'
import {
  ChatAdapter,
  ChatRepository,
  IChatAdapter,
  IChatConnection,
  IChatItemData,
  IChatMessage,
  IFunctionCall,
} from '@/feature/chat-bot'
import { ChatResolver, IReceivedMessage, prepareChatContainer } from '@/feature/chat-controller'

import { humanMessage } from './fixtures'
import { IChatBotTurn } from './chatBotHarness'
import { MockChatAdapter } from './MockChatAdapter'
import { TestChatRepository } from './TestChatMemory'

export interface IChatControllerHarnessOptions<A extends IChatAdapter> {
  controller: IConstructor<any>
  /** LLM adapter; defaults to a fresh MockChatAdapter. */
  adapter?: A
  /** Extra DI registrations: [token, instance]. */
  register?: [any, any][]
  /** Assigned to the container-scoped Auth, like production does per message. */
  authInfo?: object
  /** Chat connection the simulated messages arrive from. */
  chatConnection?: IChatConnection
}

/**
 * Drives a @chatController end-to-end without a real channel: resolves the
 * Chat, prepares the per-message container (same code path as production,
 * including @chatBot injection) and invokes the controller method.
 */
export class ChatControllerHarness<A extends IChatAdapter = MockChatAdapter> {
  readonly adapter: A
  readonly chatRepository = new TestChatRepository()
  readonly chatConnection: IChatConnection

  private channelContainer: DependencyContainer
  private options: IChatControllerHarnessOptions<A>

  constructor(options: IChatControllerHarnessOptions<A>) {
    this.options = options
    this.adapter = options.adapter ?? (new MockChatAdapter() as IChatAdapter as A)
    this.chatConnection = options.chatConnection ?? {
      chatType: 'PRIVATE',
      channelName: 'TestChannel',
      id: 'test-chat',
    }

    const child = container.createChildContainer()
    child.register(Container, { useValue: child })
    child.register(Locker, { useToken: InMemoryLocker })
    child.registerInstance(ChatRepository, this.chatRepository as unknown as ChatRepository)
    child.registerInstance(ChatAdapter, this.adapter as unknown as ChatAdapter)

    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }

    this.channelContainer = child
  }

  /** Deliver a message to a controller method, as if it came from a channel. */
  async invoke(methodName: string, message: string | IChatMessage): Promise<IChatBotTurn> {
    const controllerCtor = this.options.controller
    if (typeof (controllerCtor.prototype as any)[methodName] !== 'function') {
      throw new Error(`ChatControllerHarness: ${controllerCtor.name} has no method '${methodName}'`)
    }

    const chatResolver = this.channelContainer.resolve(ChatResolver)
    const chat = await chatResolver.resolve(this.chatConnection)

    const memory = await this.chatRepository.findMemory(chat.id)
    const itemsBefore = memory ? memory.all().length : 0
    const replies: IChatMessage[] = []

    const receivedMessage: IReceivedMessage = {
      message: humanMessage(message),
      reply: async (reply) => {
        replies.push(reply)
      },
    }

    const chatContainer = await prepareChatContainer(this.channelContainer, {
      chat,
      authInfo: this.options.authInfo,
      ...receivedMessage,
    })

    const controller = chatContainer.resolve(controllerCtor)
    await controller[methodName](receivedMessage)

    const items = (await this.history()).slice(itemsBefore)
    const toolCalls = items
      .filter((item) => item.type === 'functionCall')
      .map((item) => item.functionCall as IFunctionCall)

    return { replies, toolCalls, items }
  }

  /** Full chat history (data form) of the harness conversation. */
  async history(): Promise<IChatItemData[]> {
    const chat = await this.chatRepository.findByConnection(this.chatConnection)
    if (!chat) return []
    const memory = await this.chatRepository.findMemory(chat.id)
    return memory ? memory.allData() : []
  }
}

export function createChatControllerHarness<A extends IChatAdapter = MockChatAdapter>(
  options: IChatControllerHarnessOptions<A>,
): ChatControllerHarness<A> {
  return new ChatControllerHarness(options)
}
