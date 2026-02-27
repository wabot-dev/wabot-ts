import { IChatMessageImage } from './IChatMessageImage'
import { IChatMessageAudio } from './IChatMessageAudio'

export interface IChatMessage {
  senderId?: string
  senderName?: string
  text?: string
  images?: IChatMessageImage[]
  audios?: IChatMessageAudio[]
  object?: object
  metadata?: Record<string, string>
}
