import { IChatDocument } from './IChatDocument'
import { IChatImage } from './IChatImage'
import { IChatSender } from './IChatSender'

export interface IChatMessage {
  sender: IChatSender
  text?: string
  documents?: IChatDocument[]
  images?: IChatImage[]
}
