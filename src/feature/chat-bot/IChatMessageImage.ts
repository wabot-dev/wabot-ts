import { IStorableData } from "@/core/storable"

export interface IChatMessagesPublicImage extends IStorableData {
  name?: string
  publicUrl: string
  base64Url?: undefined
  mimeType: string
}

export interface IChatMessagesPrivateImage extends IStorableData {
  name?: string
  publicUrl?: undefined
  base64Url: string
  mimeType: string
}

export type IChatMessageImage = IChatMessagesPrivateImage | IChatMessagesPublicImage
