import { IStorableData } from "@/core/storable"

export interface IChatMessage extends IStorableData {
  senderId?: string
  senderName?: string
  text?: string
}