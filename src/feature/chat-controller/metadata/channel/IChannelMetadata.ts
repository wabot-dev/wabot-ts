import { IChatChannel } from '../../IChatChannel'
import { type IConstructor } from '@/core/generics'

export interface IChannelMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  channelConstructor: IConstructor<IChatChannel>
  channelConfig?: object
}
