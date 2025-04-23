import { IConstructor } from '@/shared'
import { IChatChannel } from '../../channel/IChatChannel'

export interface IChannelMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  channelConstructor: IConstructor<IChatChannel>
  channelConfig?: object
}
