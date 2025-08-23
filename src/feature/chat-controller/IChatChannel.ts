import { IChannelMessage } from './IChannelMessage'

export interface IChatChannel {
  listen(callback: (received: IChannelMessage) => void): void
  connect(): void
}
