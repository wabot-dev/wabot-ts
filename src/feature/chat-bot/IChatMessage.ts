import { IStorableData } from "@/core/storable"
import { IChatMessageImage } from "./IChatMessageImage"

export interface IChatMessage extends IStorableData {
  senderId?: string
  senderName?: string
  text?: string
  images?: IChatMessageImage[]
}