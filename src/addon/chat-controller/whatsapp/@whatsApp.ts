import { container } from '@/core/injection'
import { WhatsappChannelConfig, type IWhatsappChannelConfig } from './WhatsAppChannelConfig'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { WhatsAppChannel } from './WhatsAppChannel'

export function whatsApp(config: string | IWhatsappChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: WhatsAppChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new WhatsappChannelConfig(typeof config === 'string' ? config : config.number),
    })
  }
}
