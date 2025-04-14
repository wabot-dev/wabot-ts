import { ISystemMessageItem, IUserMessageItem } from './IChatItem'

export interface IChatBot {
  sendMessage(
    message: IUserMessageItem,
    callback: (message: ISystemMessageItem) => void,
  ): void | Promise<void>
}
