import { Chat } from '../Chat'

export interface IPrivateChatQuery {
  phone?: string
  email?: string
}

export interface IGroupChatQuery {
  channelType: string
  id: string
}

export interface IChatRepository {
  create(chat: Chat): Promise<void>
  findPrivateChat(query: IPrivateChatQuery): Promise<Chat | null>
  findGroupChat(query: IGroupChatQuery): Promise<Chat | null>
}
