import { IChatMessage } from './chat'
import type { IChatConnection } from './chat/Chat'

import type { IUserConnection } from './user/User'

export interface IConnectionChatMessage extends IChatMessage {
  chatConnection: IChatConnection
  userConnection: IUserConnection
  userId?: string
}
