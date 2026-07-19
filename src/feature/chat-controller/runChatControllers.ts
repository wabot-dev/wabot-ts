import { Auth } from '@/core/auth'
import { IConstructor } from '@/core/generics'
import { Idempotency } from '@/core/idempotency'
import { container, Container, DependencyContainer } from '@/core/injection'
import { addLogContext, Logger, runWithLogContext } from '@/core/logger'
import { addCount, setSpanAttributes, withSpan } from '@/core/observability'
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

  // Inbound deduplication: when a channel tags a message with `idempotencyKey`
  // (a provider message id), skip duplicate deliveries — webhook retries would
  // otherwise re-run the whole chat turn. Registered by the project runner; if
  // absent (e.g. a bare harness) dedup is simply off.
  const idempotency = container.isRegistered(Idempotency) ? container.resolve(Idempotency) : null
  const idempotencyTtl = Number(process.env.WABOT_IDEMPOTENCY_TTL_SECONDS) || 3600

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
      channel.listen((channelMessage: IChannelMessage) =>
        runWithLogContext({ channel: channelMessage.chatConnection.channelName }, async () => {
          const { idempotencyKey } = channelMessage
          if (
            idempotencyKey &&
            idempotency &&
            (await idempotency.alreadyProcessed(idempotencyKey, idempotencyTtl))
          ) {
            logger.trace(`Skipping duplicate inbound message ${idempotencyKey}`)
            return
          }

          const channelName = channelMessage.chatConnection.channelName
          addCount('wabot.chat.messages', 1, { channel: channelName })
          await withSpan('chat.turn', { 'wabot.channel': channelName }, async () => {
            try {
              const chat = await chatResolver.resolve(channelMessage.chatConnection)
              addLogContext({ chatId: chat.id })
              setSpanAttributes({ 'wabot.chat_id': chat.id })

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

              await chatController[channelMetadata.functionName](receivedMessage)
            } catch (error) {
              // Release the key so a retry can reprocess a delivery that failed.
              if (idempotencyKey && idempotency) {
                await idempotency.forget(idempotencyKey).catch(() => {})
              }
              logger.error(
                `Error in chat controller ${channelMetadata.controllerConstructor.name}.${channelMetadata.functionName}:`,
                error,
              )
            }
          })
        }),
      )

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
