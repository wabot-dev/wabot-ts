import { type IChatMessage } from '@/message'

export interface IChatBot {
  sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => void,
  ): void | Promise<void>
}
