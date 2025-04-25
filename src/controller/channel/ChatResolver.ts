import { Chat, type IChatConnection, ChatRepository } from '@/chatbot'
import { type IMessageOrigin } from './IMessageContext'
import { injectable } from '@/injection'

@injectable()
export class ChatResolver {
  constructor(private chatRepository: ChatRepository) {}

  async resolve(origin: IMessageOrigin): Promise<Chat> {
    if (origin.chatType === 'GROUP') {
      return this.resolveGroupChat({ channelType: origin.channelType.name, chatId: origin.chatId })
    }
    return this.resolvePrivateChat({ channelType: origin.channelType.name, chatId: origin.chatId })
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
