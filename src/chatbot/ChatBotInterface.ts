import { ChatMemory, IChatMemoryRepository, IUserMessageItem } from '@/chatbot'
import { Context, IContext } from '@/context'
import { IChatMessage } from '@/message'
import { IConstructor } from '@/shared'

import { Container, container, DependencyContainer } from '@/injection'
import { IMindset, Mindset } from '@/mindset'
import { ChatBot } from './ChatBot'
import { ChatBotAdapter, IChatBotAdapter } from './ChatBotAdapter'

export abstract class ChatBotInterface {
  protected chatMemoryRepository: IChatMemoryRepository
  protected mindset: IMindset

  constructor(
    protected mindsetClass: IConstructor<IMindset>,
    protected adapterClass: IConstructor<IChatBotAdapter>,
    protected memoryClass: IConstructor<IChatMemoryRepository>,
  ) {
    this.chatMemoryRepository = container.resolve(memoryClass)
    this.mindset = container.resolve(this.mindsetClass)
  }

  abstract start(): void | Promise<void>

  protected async handleIncomingMessage(context: IContext, chatMessage: IChatMessage) {
    const tempContainer = await this.prepareContainer(context)

    const chatBot = tempContainer.resolve(ChatBot)

    const chatItem: IUserMessageItem = {
      type: 'USER_MESSAGE',
      userId: context.userId,
      content: chatMessage,
    }

    chatBot.sendMessage(chatItem, (botMessage) => {
      context.chat.out(botMessage)
    })
  }

  private async prepareContainer(context: IContext): Promise<DependencyContainer> {
    const tempContainer = container.createChildContainer()
    tempContainer.register(Container, { useValue: tempContainer })

    tempContainer.register(Context, { useValue: new Context(context.userId, context.chat) })

    const chatMemory = await this.chatMemoryRepository.find(context.chat.chatId)
    tempContainer.register(ChatMemory, { useValue: chatMemory })

    tempContainer.register(Mindset, { useClass: this.mindsetClass })
    tempContainer.register(ChatBotAdapter as any, { useClass: this.adapterClass })
    return tempContainer
  }
}
