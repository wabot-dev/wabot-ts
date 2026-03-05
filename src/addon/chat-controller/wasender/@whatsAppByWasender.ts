import { container } from '@/core/injection'
import { WhatsAppByWasenderChannelConfig } from './WhatsAppByWasenderChannelConfig'
import { type IWhatsAppByWasenderChannelConfig } from './IWhatsAppByWasenderChannelConfig'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { WhatsAppByWasenderChannel } from './WhatsAppByWasenderChannel'

export function whatsAppByWasender(config: IWhatsAppByWasenderChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: WhatsAppByWasenderChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new WhatsAppByWasenderChannelConfig(config),
    })
  }
}
