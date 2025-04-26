import type { IChatMessage, IMessageContext } from '@/core'

export interface IReceivedMessage extends IMessageContext {
  reply: (message: IChatMessage) => void
}

export interface IChatChannel {
  listen(callback: (message: IReceivedMessage) => void): void
  connect(): void
}
