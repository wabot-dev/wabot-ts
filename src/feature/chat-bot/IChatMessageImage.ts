export interface IChatMessagesPublicImage {
  name?: string
  publicUrl: string
  base64Url?: undefined
  mimeType: string
}

export interface IChatMessagesPrivateImage {
  name?: string
  publicUrl?: undefined
  base64Url: string
  mimeType: string
}

export type IChatMessageImage = IChatMessagesPrivateImage | IChatMessagesPublicImage
