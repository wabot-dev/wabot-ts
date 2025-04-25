import { type IChatDocument } from './IChatDocument'
import { type IChatImage } from './IChatImage'
import { type IChatSender } from './IChatSender'

export interface IChatMessage {
  sender: IChatSender
  text?: string
  documents?: IChatDocument[]
  images?: IChatImage[]
}
