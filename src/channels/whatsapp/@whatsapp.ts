import { container } from '@/injection'
import { WhatsappChannelConfig, type IWhatsappChannelConfig } from './WhatsappChannelConfig'
import { ControllerMetadataStore } from '@/controller'
import type { IConstructor } from '@/core'
import { WhatsAppChannel } from './WhatsappChannel'

export function whatsapp(config: IWhatsappChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: WhatsAppChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new WhatsappChannelConfig(config.number),
    })
  }
}
