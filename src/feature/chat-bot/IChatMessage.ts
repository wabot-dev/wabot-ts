import { IChatMessageAudio } from './IChatMessageAudio'
import { IChatMessageDocument } from './IChatMessageDocument'
import { IChatMessageImage } from './IChatMessageImage'

export interface IChatMessage {
  senderId?: string
  senderName?: string
  text?: string
  images?: IChatMessageImage[]
  documents?: IChatMessageDocument[]
  audios?: IChatMessageAudio[]
  object?: object
  metadata?: Record<string, string>
}
