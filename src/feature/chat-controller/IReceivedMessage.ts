import { IChatMessage } from "@/feature/chat-bot"

export interface IReceivedMessage {
  message: IChatMessage
  reply: (message: IChatMessage) => void
}
