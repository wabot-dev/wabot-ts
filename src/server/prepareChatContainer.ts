import { Context, IContext } from '@/context'
import { IConstructor } from '@/shared'

import {
  ChatBot,
  ChatBotMetadataStore,
  ChatMemory,
  ChatRepository,
} from '@/chatbot'
import { Container, DependencyContainer } from '@/injection'
import { IMindset, Mindset } from '@/mindset'

export async function prepareChatContainer(
  container: DependencyContainer,
  context: IContext,
  mindsetCtor?: IConstructor<IMindset>,
): Promise<DependencyContainer> {
  const chatContainer = container.createChildContainer()
  chatContainer.register(Container, { useValue: chatContainer })
  chatContainer.register(Context, { useValue: new Context(context.chat, context.user) })

  const chatRepository = container.resolve(ChatRepository)
  const chatMemory = await chatRepository.findMemory(context.chat.chatId)
  if (!chatMemory) {
    throw new Error('Not found Chat Memory for Chat with Id=' + context.chat.chatId)
  }
  chatContainer.register(ChatMemory, { useValue: chatMemory })

  const chatBotMetadataStore = container.resolve(ChatBotMetadataStore)
  const chatBots = chatBotMetadataStore.getChatBotsMetadata()
  for (const chatBotMetadata of chatBots) {
    chatContainer.beforeResolution(chatBotMetadata.constructor, (a, b) => {
      const subContainer = chatContainer.createChildContainer()
      subContainer.register(Mindset, { useClass: chatBotMetadata.mindsetConstructor })
      const chatBot = subContainer.resolve(ChatBot)
      chatContainer.register(chatBotMetadata.injectionToken, {useValue: chatBot})
    })
  }
  if (mindsetCtor) {
    chatContainer.register(Mindset, { useClass: mindsetCtor })
  }
  return chatContainer
}
