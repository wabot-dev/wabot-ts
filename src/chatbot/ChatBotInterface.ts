import { ChatMemory, IChatMemoryRepository } from '@/chatbot'
import { Context, IContext } from '@/context'
import { IConstructor } from '@/shared'

import { IMessageContext } from '@/channel/IMessageContext'
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

  protected async handleIncomingMessage(context: IMessageContext) {
    const tempContainer = await this.prepareContainer({ chat: context })

    const chatBot = tempContainer.resolve(ChatBot)

    chatBot.sendMessage(context.message, (botMessage) => {
      context.reply(botMessage)
    })
  }

  private async prepareContainer(context: IContext): Promise<DependencyContainer> {
    const tempContainer = container.createChildContainer()
    tempContainer.register(Container, { useValue: tempContainer })

    tempContainer.register(Context, { useValue: new Context(context.chat, context.user) })

    const chatMemory = await this.chatMemoryRepository.find(context.chat.chatId)
    tempContainer.register(ChatMemory, { useValue: chatMemory })

    tempContainer.register(Mindset, { useClass: this.mindsetClass })
    tempContainer.register(ChatBotAdapter as any, { useClass: this.adapterClass })
    return tempContainer
  }
}
