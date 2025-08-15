import type { IChatConnection } from './chat/Chat'
import type { IChatDocument } from './chat/IChatDocument'
import type { IChatImage } from './chat/IChatImage'
import { IStorableData } from './Storable'
import type { IUserConnection } from './user/User'

export interface IChatMessage extends IStorableData {
  text?: string
  documents?: IChatDocument[]
  images?: IChatImage[]
  senderName: string
}

export interface IConnectionChatMessage extends IChatMessage {
  chatConnection: IChatConnection
  userConnection: IUserConnection
  userId?: string
}
