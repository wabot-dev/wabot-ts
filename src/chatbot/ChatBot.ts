import { IChatBot } from './IChatBot'
import { IUserMessageItem, ISystemMessageItem } from './IChatItem'

export abstract class ChatBot implements IChatBot {
  sendMessage(message: IUserMessageItem, callback: (message: ISystemMessageItem) => void): void {
    throw new Error('Method not implemented.')
  }
}
