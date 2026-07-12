import { container, Container, DependencyContainer } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { Logger } from '@/core/logger'
import { Mindset } from '@/feature/mindset'
import { IIncomingVoiceCall } from './IIncomingVoiceCall'
import { IVoiceChannel } from './IVoiceChannel'
import { VoiceBot } from './VoiceBot'
import { VoiceBotMetadataStore, VoiceControllerMetadataStore } from './metadata'

const logger = new Logger('wabot:voice-controller')

/**
 * Builds a per-call child container and registers a VoiceBot (bound to the right
 * Mindset) under each `@voiceBot` injection token — the voice analogue of
 * `prepareChatContainer`.
 */
function prepareVoiceContainer(parent: DependencyContainer): DependencyContainer {
  const callContainer = parent.createChildContainer()
  callContainer.register(Container, { useValue: callContainer })

  const voiceBots = container.resolve(VoiceBotMetadataStore).getVoiceBotsMetadata()
  for (const metadata of voiceBots) {
    callContainer.beforeResolution(metadata.constructor, () => {
      const subContainer = callContainer.createChildContainer()
      subContainer.register(Mindset, { useClass: metadata.mindsetConstructor })
      const voiceBot = subContainer.resolve(VoiceBot)
      callContainer.register(metadata.injectionToken, { useValue: voiceBot })
    })
  }
  return callContainer
}

/**
 * Boots voice controllers: resolves each channel, listens for incoming calls,
 * and dispatches each call to the controller method (which picks the VoiceBot).
 * With no argument, boots every `@voiceController`. Mirrors `runChatControllers`.
 */
export function runVoiceControllers(controllers?: IConstructor<any>[]) {
  const store = container.resolve(VoiceControllerMetadataStore)
  const targets = controllers ?? (store.getAllVoiceControllerConstructors() as IConstructor<any>[])

  for (const controllerCtor of targets) {
    const metadata = store.getVoiceControllerMetadata(controllerCtor)
    if (!metadata) continue

    for (const channelMetadata of metadata.channels) {
      const channelContainer = container.createChildContainer()
      channelContainer.register(Container, { useValue: channelContainer })
      if (channelMetadata.channelConfig) {
        channelContainer.register(channelMetadata.channelConfig.constructor as any, {
          useValue: channelMetadata.channelConfig,
        })
      }

      const channel = channelContainer.resolve<IVoiceChannel>(channelMetadata.channelConstructor)
      channel.listen(async (call: IIncomingVoiceCall) => {
        try {
          const callContainer = prepareVoiceContainer(channelContainer)
          if (call.injectInstances) {
            for (const [token, instance] of call.injectInstances) {
              callContainer.registerInstance(token as any, instance)
            }
          }
          const controller = callContainer.resolve<any>(channelMetadata.controllerConstructor)
          await controller[channelMetadata.functionName](call)
        } catch (error) {
          logger.error(
            `Error in voice controller ${channelMetadata.controllerConstructor.name}.${channelMetadata.functionName}:`,
            error,
          )
        }
      })

      channel.connect()
    }
  }
}
