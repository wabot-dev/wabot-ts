import dotenv from 'dotenv'
dotenv.config()

import { OpenaiChatBotAdapter } from '@/ai'
import {
  ChatBotAdapter,
  ChatRepository,
  type IChatBotAdapter,
  type IChatRepository,
  RamChatRepository,
} from '@/chatbot'
import { ControllerMetadataStore } from '@/controller'
import type { IMessageContext } from '@/core'
import { container } from '@/injection'
import { type IConstructor } from '@/shared'
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
        const chatContainer = await prepareChatContainer(channelContainer, messageContext)
        const chatController = chatContainer.resolve(channelMetadata.controllerConstructor)
        chatController[channelMetadata.functionName](messageContext)
      })

      channel.connect()
    }
  }
}
