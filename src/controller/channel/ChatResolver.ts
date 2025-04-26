
import { Chat, ChatRepository, type IChatConnection } from '@/core'
import { injectable } from '@/injection'

@injectable()
export class ChatResolver {
  constructor(private chatRepository: ChatRepository) {}

  async resolve(connection: IChatConnection): Promise<Chat> {
    if (connection.chatType === 'GROUP') {
      return this.resolveGroupChat(connection)
    }
    return this.resolvePrivateChat(connection)
  }

  private async resolveGroupChat(connection: IChatConnection): Promise<Chat> {
    let chat = await this.chatRepository.findByConnection(connection)
    if (!chat) {
      chat = new Chat({ type: 'GROUP', connections: [connection] })
      await this.chatRepository.create(chat)
    }
    return chat
  }

  private async resolvePrivateChat(connection: IChatConnection): Promise<Chat> {
    let chat = await this.chatRepository.findByConnection(connection)
    if (!chat) {
      chat = new Chat({ type: 'PRIVATE', connections: [connection] })
      await this.chatRepository.create(chat)
    }
    return chat
  }
}
