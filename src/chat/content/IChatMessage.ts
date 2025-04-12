import { IChatDocument } from './IChatDocument'
import { IChatImage } from './IChatImage'

export interface IChatMessage {
  text?: string
  documents?: IChatDocument[]
  images?: IChatImage[]
}
