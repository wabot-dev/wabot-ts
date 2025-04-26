import { singleton } from '@/injection'
import type { IUserConnection, User } from '../User'



export interface IUserRepository {
  create(chat: User): Promise<void>
  findByConnection(query: IUserConnection): Promise<User | null>
  
}

@singleton()
export class UserRepository implements IUserRepository {
  create(chat: User): Promise<void> {
    throw new Error('Method not implemented.')
  }

  findByConnection(query: IUserConnection): Promise<User | null> {
    throw new Error('Method not implemented.')
  }
}