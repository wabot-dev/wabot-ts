import dotenv from 'dotenv'
dotenv.config()

import { ControllerMetadataStore } from '@/controller'
import { type IMessageContext } from '@/core'
import { container } from '@/injection'
import { type IConstructor } from '@/core'
import { prepareChatContainer } from './prepareChatContainer'

export interface IServerProvider<T, ST extends T> {
  replace: IConstructor<T>
  with: IConstructor<ST>
  singleton?: true
}

export interface IServerConfig {
  controllers: IConstructor<any>[]
  providers?: IServerProvider<unknown, unknown>[]
}

export function runServer(config: IServerConfig) {
  for (const provider of config.providers ?? []) {
    if (provider.singleton) {
      container.registerSingleton(provider.replace, provider.with)
    } else {
      container.register(provider.replace, provider.with)
    }
  }

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
