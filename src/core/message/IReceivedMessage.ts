import type { IChatConnection } from '../chat'
import type { IUserConnection } from '../user'
import { type IChatDocument } from './IChatDocument'
import { type IChatImage } from './IChatImage'

export interface IChatMessage {
  text?: string
  documents?: IChatDocument[]
  images?: IChatImage[]
  senderName: string
}

export interface IReceivedChatMessage extends IChatMessage {
  chatConnection: IChatConnection
  userConnection: IUserConnection
  userId?: string
}
