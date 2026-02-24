export interface IChatMessagesPublicImage {
  name?: string
  publicUrl: string
  base64Url?: undefined
  mimeType: string
  id: string
}

export interface IChatMessagesPrivateImage {
  name?: string
  publicUrl?: undefined
  base64Url: string
  mimeType: string
  id: string
}

export type IChatMessageImage = IChatMessagesPrivateImage | IChatMessagesPublicImage
