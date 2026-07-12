import { type IConstructor } from '@/core/generics'
import { IVoiceChannel } from '../IVoiceChannel'

export interface IVoiceControllerMetadata {
  controllerConstructor: Function
}

export interface IVoiceChannelMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  channelConstructor: IConstructor<IVoiceChannel>
  channelConfig?: object
}
