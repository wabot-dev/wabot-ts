import { Chat, ChatRepository, IChatConnection } from '@/feature/chat-bot'
import { injectable } from '@/core/injection'
import { Locker } from '@/core/lock'

@injectable()
export class ChatResolver {
  constructor(
    private chatRepository: ChatRepository,
    private locker: Locker,
  ) {}

  async resolve(connection: IChatConnection): Promise<Chat> {
    if (connection.chatType === 'GROUP') {
      return this.resolveGroupChat(connection)
    }
    return this.resolvePrivateChat(connection)
  }

  private async resolveGroupChat(connection: IChatConnection): Promise<Chat> {
    // Fast path: check without lock
    let chat = await this.chatRepository.findByConnection(connection)
    if (chat) {
      return chat
    }

    // Slow path: acquire lock and double-check
    const lockKey = this.buildLockKey(connection)
    return this.locker.withKey(lockKey).run(async () => {
      chat = await this.chatRepository.findByConnection(connection)
      if (!chat) {
        chat = new Chat({ type: 'GROUP', connections: [connection] })
        await this.chatRepository.create(chat)
      }
      return chat
    })
  }

  private async resolvePrivateChat(connection: IChatConnection): Promise<Chat> {
    // Fast path: check without lock
    let chat = await this.chatRepository.findByConnection(connection)
    if (chat) {
      return chat
    }

    // Slow path: acquire lock and double-check
    const lockKey = this.buildLockKey(connection)
    return this.locker.withKey(lockKey).run(async () => {
      chat = await this.chatRepository.findByConnection(connection)
      if (!chat) {
        chat = new Chat({ type: 'PRIVATE', connections: [connection] })
        await this.chatRepository.create(chat)
      }
      return chat
    })
  }

  private buildLockKey(connection: IChatConnection): string {
    return `chat-resolver:${connection.channelName}:${connection.id}`
  }
}
