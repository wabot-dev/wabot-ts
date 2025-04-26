import { type IConstructor } from '@/shared'

import { ChatBot, ChatBotMetadataStore, ChatMemory, ChatRepository } from '@/chatbot'
import { Container, type DependencyContainer } from '@/injection'
import { type IMindset, Mindset } from '@/mindset'
import { MessageContext, type IMessageContext } from '@/core'

export async function prepareChatContainer(
  container: DependencyContainer,
  context: IMessageContext,
  mindsetCtor?: IConstructor<IMindset>,
): Promise<DependencyContainer> {
  const chatContainer = container.createChildContainer()
  chatContainer.register(Container, { useValue: chatContainer })
  chatContainer.register(MessageContext, {
    useValue: new MessageContext(context.message, context.chat, context.user),
  })

  const chatRepository = container.resolve(ChatRepository)
  const chatMemory = await chatRepository.findMemory(context.chat.getId())
  if (!chatMemory) {
    throw new Error('Not found Chat Memory for Chat with Id=' + context.chat.getId())
  }
  chatContainer.register(ChatMemory, { useValue: chatMemory })

  const chatBotMetadataStore = container.resolve(ChatBotMetadataStore)
  const chatBots = chatBotMetadataStore.getChatBotsMetadata()
  for (const chatBotMetadata of chatBots) {
    chatContainer.beforeResolution(chatBotMetadata.constructor, (a, b) => {
      const subContainer = chatContainer.createChildContainer()
      subContainer.register(Mindset, { useClass: chatBotMetadata.mindsetConstructor })
      const chatBot = subContainer.resolve(ChatBot)
      chatContainer.register(chatBotMetadata.injectionToken, { useValue: chatBot })
    })
  }
  if (mindsetCtor) {
    chatContainer.register(Mindset, { useClass: mindsetCtor })
  }
  return chatContainer
}
