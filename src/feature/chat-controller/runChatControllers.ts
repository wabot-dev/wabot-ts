import { Auth } from '@/core/auth'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Chat, ChatBot, ChatBotMetadataStore, ChatMemory, ChatRepository } from '@/feature/chat-bot'
import { IMindset, Mindset } from '@/feature/mindset'
import { ChatResolver } from './ChatResolver'
import { IChannelMessage } from './IChannelMessage'
import { IChatChannel } from './IChatChannel'
import { IMessageContext } from './IMessageContext'
import { IReceivedMessage } from './IReceivedMessage'
import { ControllerMetadataStore } from './metadata'

export async function prepareChatContainer(
  container: DependencyContainer,
  messageContext: IMessageContext,
  mindsetCtor?: IConstructor<IMindset>,
): Promise<DependencyContainer> {
  const chatContainer = container.createChildContainer()
  chatContainer.register(Container, { useValue: chatContainer })
  chatContainer.registerInstance(Chat, messageContext.chat)

  const chatRepository = container.resolve(ChatRepository)
  const chatMemory = await chatRepository.findMemory(messageContext.chat.id)

  if (!chatMemory) {
    throw new Error('Not found Chaqt Memory for Chat with Id=' + messageContext.chat.id)
  }
  chatContainer.registerInstance(ChatMemory, chatMemory)

  if (messageContext.authInfo) {
    const auth = chatContainer.resolve(Auth) as Auth<object>
    auth.assign(messageContext.authInfo)
  }

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

const logger = new Logger('wabot:chat-controller')

export function runChatControllers(controllers: IConstructor<any>[]): IChatChannel[] {
  const metadataStore = container.resolve(ControllerMetadataStore)
  const chatResolver = container.resolve(ChatResolver)
  const channels: IChatChannel[] = []

  for (const controllerCtor of controllers) {
    const chatControllerMetadata = metadataStore.getChatControllerMetadata(controllerCtor)
    if (!chatControllerMetadata) {
      continue
    }
    for (const channelMetadata of chatControllerMetadata.channels) {
      const channelContainer = container.createChildContainer()
      channelContainer.register(Container, { useValue: channelContainer })
      if (channelMetadata.channelConfig) {
        channelContainer.register(channelMetadata.channelConfig.constructor as any, {
          useValue: channelMetadata.channelConfig,
        })
      }
      const channel = channelContainer.resolve(channelMetadata.channelConstructor)
      channel.listen(async (channelMessage: IChannelMessage) => {
        const chat = await chatResolver.resolve(channelMessage.chatConnection)

        const chatContainer = await prepareChatContainer(channelContainer, {
          chat,
          ...channelMessage,
        })

        if (channelMessage.injectInstances) {
          for (const [token, instance] of channelMessage.injectInstances) {
            chatContainer.registerInstance(token, instance)
          }
        }

        const chatController = chatContainer.resolve(channelMetadata.controllerConstructor)

        const receivedMessage: IReceivedMessage = {
          message: channelMessage.message,
          reply: channelMessage.reply,
        }

        try {
          await chatController[channelMetadata.functionName](receivedMessage)
        } catch (error) {
          logger.error(
            `Error in chat controller ${channelMetadata.controllerConstructor.name}.${channelMetadata.functionName}:`,
            error,
          )
        }
      })

      channel.connect()
      channels.push(channel)
    }
  }

  return channels
}

/**
 * Disconnect chat channels so no new inbound messages are delivered. Used
 * during graceful shutdown; errors are logged but never thrown, so one channel
 * failing to disconnect does not block the others.
 */
export function stopChatControllers(channels: IChatChannel[]): void {
  for (const channel of channels) {
    try {
      channel.disconnect()
    } catch (error) {
      logger.error('Error disconnecting chat channel:', error)
    }
  }
}
