import { IChatBot, IChatMemoryRepository, IUserMessageItem, OpenaiChatBot } from '@/chatbot'
import { Context, IContext } from '@/context'
import { IChatMessage } from '@/message'
import { IConstructor } from '@/shared'
import { IMindset } from './IMindset'

import { container, DependencyContainer, Type } from '@/injection'
import { IMindsetMetadata, MindsetMetadataStore } from './metadata'

export abstract class MindsetInterface {
  private metadata: IMindsetMetadata
  protected mindset: IMindset

  constructor(
    mindsetConstructor: IConstructor<IMindset>,
    protected chatMemoryRepository: IChatMemoryRepository,
  ) {
    const metadataStore = container.resolve(MindsetMetadataStore)
    this.mindset = container.resolve(mindsetConstructor)
    this.metadata = metadataStore.getMindsetMetadata(mindsetConstructor)
  }

  abstract start(): void | Promise<void>

  protected async handleIncomingMessage(context: IContext, chatMessage: IChatMessage) {
    const tempContainer = await this.prepareContainer(context)

    const chatBot = tempContainer.resolve<IChatBot>(Type.IChatBot)

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
    tempContainer.register(Type.Container, { useValue: tempContainer })

    tempContainer.register(Type.IContext, { useValue: context })
    tempContainer.register(Context, { useValue: new Context(context) })

    const chatMemory = await this.chatMemoryRepository.find(context.chat.chatId)
    tempContainer.register(Type.IChatMemory, { useValue: chatMemory })

    tempContainer.register(Type.IMindsetMetadata, { useValue: this.metadata })
    tempContainer.register(Type.IMindset, { useValue: this.mindset })

    this.prepareChatBot(tempContainer)

    return tempContainer
  }

  private prepareChatBot(tempContainer: DependencyContainer) {
    if (process.env.OPENAI_API_KEY) {
      this.prepareOpenaiChatBot(tempContainer)
    } else {
      throw new Error('Not found configurations for supported LLM apis')
    }
  }

  private prepareOpenaiChatBot(tempContainer: DependencyContainer) {
    tempContainer.register(Type.IChatBot, { useClass: OpenaiChatBot })

    tempContainer.register(Type.IOpenaiChatbotConfig, {
      useValue: { model: 'gpt-4o' },
    })
  }
}
