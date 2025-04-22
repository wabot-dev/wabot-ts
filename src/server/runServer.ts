import dotenv from 'dotenv'
dotenv.config()

import {
  ChatBotAdapter,
  ChatRepository,
  IChatBotAdapter,
  IChatRepository,
  RamChatRepository,
} from '@/chatbot'
import { IConstructor } from '@/shared'
import { container } from '@/injection'
import { ControllerMetadataStore, IMessageContext } from '@/controller'
import { OpenaiChatBotAdapter } from '@/ai'
import { prepareChatContainer } from './prepareChatContainer'

export interface IServerConfig {
  controllers: IConstructor<any>[]
  chatRepository?: IConstructor<IChatRepository>
  chatBotAdapter?: IConstructor<IChatBotAdapter>
}

export function runServer(config: IServerConfig) {
  container.registerSingleton(ChatRepository, config.chatRepository ?? RamChatRepository)
  container.register(ChatBotAdapter, config.chatBotAdapter ?? OpenaiChatBotAdapter)

  const metadataStore = container.resolve(ControllerMetadataStore)
  for (const controllerCtor of config.controllers) {
    const chatControllerMetadata = metadataStore.getChatControllerMetadata(controllerCtor)
    if (!chatControllerMetadata) {
      continue
    }
    for (const channelMetadata of chatControllerMetadata.channels) {
      const channelContainer = container.createChildContainer()
      if (channelMetadata.channelConfig) {
        channelContainer.register(channelMetadata.channelConfig.constructor as any, {
          useValue: channelMetadata.channelConfig,
        })
      }
      const channel = channelContainer.resolve(channelMetadata.channelConstructor)
      channel.listen(async (messageContext: IMessageContext) => {
        const chatContainer = await prepareChatContainer(channelContainer, { chat: messageContext })
        const chatController = chatContainer.resolve(channelMetadata.controllerConstructor)
        chatController[channelMetadata.functionName](messageContext)
      })

      channel.connect()
    }
  }
}
