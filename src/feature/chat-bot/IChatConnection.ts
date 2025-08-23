import { IStorableData } from "@/core/storable"

export interface IChatConnection extends IStorableData {
  channelName: string
  id: string
}
