import type { IMessageContext } from "@/core"


export interface IChatChannel {
  listen(callback: (message: IMessageContext) => void): void
  connect(): void
}
