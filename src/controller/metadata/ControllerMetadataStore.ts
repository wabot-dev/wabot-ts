import { singleton } from '@/injection'
import { IChatControllerMetadata } from './controller/IChatControllerMetadata'
import { IChannelMetadata } from './channel/IChannelMetadata'

@singleton()
export class ControllerMetadataStore {
  private channels = new Map<Function, Map<string, IChannelMetadata[]>>()
  private chatControllers = new Map<Function, IChatControllerMetadata>()

  saveChannelMetadata(channelMetadata: IChannelMetadata) {
    let controllerChannels = this.channels.get(channelMetadata.controllerConstructor)
    if (!controllerChannels) {
      controllerChannels = new Map<string, IChannelMetadata[]>()
      this.channels.set(channelMetadata.controllerConstructor, controllerChannels)
    }

    let functionChannels = controllerChannels.get(channelMetadata.functionName)
    if (!functionChannels) {
      functionChannels = []
      controllerChannels.set(channelMetadata.functionName, functionChannels)
    }
    functionChannels.push(channelMetadata)
  }

  saveChatControllerMetadata(controllerMetadata: IChatControllerMetadata) {
    this.chatControllers.set(controllerMetadata.controllerConstructor, controllerMetadata)
  }

  getChatControllerMetadata(controllerConstructor: Function) {
    const mainMetadata = this.chatControllers.get(controllerConstructor)
    if (!mainMetadata) return null
    const config = mainMetadata

    const channelsMap = this.channels.get(controllerConstructor)
    const channels = Array.from(channelsMap?.values() ?? [])
      .map((channelMetadata) => channelMetadata)
      .flat()

    return {
      config,
      channels,
    }
  }
}
