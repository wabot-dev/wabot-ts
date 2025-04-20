import { IMessageContext } from "./IMessageContext"


export interface IChatChannel {
  listen(callback: (message: IMessageContext) => void): void
  connect(): void
}
