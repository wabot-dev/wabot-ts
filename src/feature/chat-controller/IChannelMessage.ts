import { IChatConnection } from '@/feature/chat-bot'
import { IReceivedMessage } from './IReceivedMessage'
import { IStorableData } from '@/core/storable'

export interface IChannelMessage extends IReceivedMessage {
  chatConnection: IChatConnection
  authInfo?: IStorableData
  setAuthInfo?: (authInfo: IStorableData | undefined) => void
}
