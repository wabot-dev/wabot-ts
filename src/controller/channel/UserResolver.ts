import { type IUserConnection, User, UserRepository } from '@/core'
import { singleton } from '@/injection'

@singleton()
export class UserResolver {
  constructor(private userRepository: UserRepository) {}

  async resolve(connection: IUserConnection): Promise<User | null> {
    let user = await this.userRepository.findByConnection(connection)
    return user
  }
}
