import { IChatMessageFile } from '@/feature/chat-bot'

export interface IHubSpotMessagePayload {
  threadId: string
  messageId: string
  senderId: string
  senderName?: string
  channel?: string
  text?: string
  files: IChatMessageFile[]
  metadata: Record<string, string>
}
