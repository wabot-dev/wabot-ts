import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { WhatsappChannelConfig, type IWhatsappChannelConfig } from './WhatsAppChannelConfig'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'
import { WhatsAppChannel } from './WhatsAppChannel'

export function whatsApp(config: string | IWhatsappChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const result = typeof config === 'string' ? { number: config } : config
    const resolved = resolveConfigReferences(result) as {
      number: string
      accessToken?: string
      businessNumberId?: string
    }
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: WhatsAppChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new WhatsappChannelConfig(
        resolved.number,
        resolved.accessToken,
        resolved.businessNumberId,
      ),
    })
  }
}
