import { singleton } from '@/injection'
import { IChatControllerMetadata } from './controller/IChatControllerMetadata'
import { IChannelMetadata } from './channel/IChannelMetadata'

@singleton()
export class ControllerMetadataStore {
  private channelsMetadata = new Map<Function, Map<string, IChannelMetadata[]>>()
  private controllersMetadata = new Map<Function, IChatControllerMetadata[]>()

  saveChannelMetadata(channelMetadata: IChannelMetadata) {
    let controllerChannels = this.channelsMetadata.get(channelMetadata.controllerConstructor)
    if (!controllerChannels) {
      controllerChannels = new Map<string, IChannelMetadata[]>()
      this.channelsMetadata.set(channelMetadata.channelConstructor, controllerChannels)
    }

    let functionChannels = controllerChannels.get(channelMetadata.functionName)
    if (!functionChannels) {
      functionChannels = []
      controllerChannels.set(channelMetadata.functionName, functionChannels)
    }
    functionChannels.push(channelMetadata)
  }
}
