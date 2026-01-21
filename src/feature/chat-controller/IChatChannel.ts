import { IChannelMessage } from './IChannelMessage'

export interface IChatChannel {
  listen(callback: (received: IChannelMessage) => Promise<void>): void
  connect(): void
}
