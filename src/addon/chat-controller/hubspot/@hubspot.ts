import { container } from '@/core/injection'
import { resolveConfigReferences } from '@/core/config'
import { ControllerMetadataStore } from '@/feature/chat-controller'
import type { IConstructor } from '@/core/generics'

import { HubSpotChannel } from './HubSpotChannel'
import { HubSpotChannelConfig } from './HubSpotChannelConfig'
import type { IHubSpotChannelConfig } from './IHubSpotChannelConfig'

export function hubspot(config: IHubSpotChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const resolved = resolveConfigReferences(config)
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: HubSpotChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new HubSpotChannelConfig({
        accessToken: resolved.accessToken,
        webhookSecret: resolved.webhookSecret,
        webhookPath: resolved.webhookPath,
        appId: resolved.appId,
        senderActorId: resolved.senderActorId,
      }),
    })
  }
}
