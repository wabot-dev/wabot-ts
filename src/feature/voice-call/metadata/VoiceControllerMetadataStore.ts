import { singleton } from '@/core/injection'
import {
  type IVoiceChannelMetadata,
  type IVoiceControllerMetadata,
} from './IVoiceControllerMetadata'

@singleton()
export class VoiceControllerMetadataStore {
  private channels = new Map<Function, Map<string, IVoiceChannelMetadata[]>>()
  private controllers = new Map<Function, IVoiceControllerMetadata>()

  saveVoiceChannelMetadata(metadata: IVoiceChannelMetadata) {
    let controllerChannels = this.channels.get(metadata.controllerConstructor)
    if (!controllerChannels) {
      controllerChannels = new Map<string, IVoiceChannelMetadata[]>()
      this.channels.set(metadata.controllerConstructor, controllerChannels)
    }
    let functionChannels = controllerChannels.get(metadata.functionName)
    if (!functionChannels) {
      functionChannels = []
      controllerChannels.set(metadata.functionName, functionChannels)
    }
    functionChannels.push(metadata)
  }

  saveVoiceControllerMetadata(metadata: IVoiceControllerMetadata) {
    this.controllers.set(metadata.controllerConstructor, metadata)
  }

  getAllVoiceControllerConstructors(): Function[] {
    return Array.from(this.controllers.keys())
  }

  getVoiceControllerMetadata(controllerConstructor: Function) {
    const config = this.controllers.get(controllerConstructor)
    if (!config) return null
    const channelsMap = this.channels.get(controllerConstructor)
    const channels = Array.from(channelsMap?.values() ?? []).flat()
    return { config, channels }
  }
}
