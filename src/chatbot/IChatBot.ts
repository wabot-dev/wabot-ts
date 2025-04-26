import { type IChatMessage } from '@/core'

export interface IChatBot {
  sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => void,
  ): void | Promise<void>
}
