import { v4 as uuidv4 } from 'uuid'
import { User, type IUserConnection } from '../../User'
import { type IUserRepository } from '../IUserRepository'
import { singleton } from '@/injection'

@singleton()
export class RamUserRepository implements IUserRepository {
  private items: User[] = []

  async create(chat: User): Promise<void> {
    if (chat.wasCreated()) {
      throw new Error('User already created')
    }
    chat['data'].id = uuidv4()
    chat['data'].createdAt = new Date().getTime()

    chat.validate()

    this.items.push(chat)
  }

  async findByConnection(query: IUserConnection): Promise<User | null> {
    return this.items.find((item) => item.hasConnection(query)) ?? null
  }

  async update(chat: User): Promise<void> {
    // TODO
  }
}
