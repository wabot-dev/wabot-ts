import { IChatMessageDocument } from './IChatMessageDocument'
import { IChatMessageImage } from './IChatMessageImage'

export interface IChatMessage {
  senderId?: string
  senderName?: string
  text?: string
  images?: IChatMessageImage[]
  documents?: IChatMessageDocument[]
  object?: object
  metadata?: Record<string, string>
}
