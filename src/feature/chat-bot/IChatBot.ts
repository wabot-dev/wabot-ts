import { type IChatMessage } from './IChatMessage'

export interface IChatBot {
  sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => void,
  ): void | Promise<void>
}
