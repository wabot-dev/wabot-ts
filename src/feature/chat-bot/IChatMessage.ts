import { IChatMessageImage } from './IChatMessageImage'

export interface IChatMessage {
  senderId?: string
  senderName?: string
  text?: string
  images?: IChatMessageImage[]
}
