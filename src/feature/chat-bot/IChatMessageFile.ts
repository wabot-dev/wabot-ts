export interface IChatMessagesPublicFile {
  name?: string
  publicUrl: string
  base64Url?: undefined
  mimeType: string
  id: string
}

export interface IChatMessagesPrivateFile {
  name?: string
  publicUrl?: undefined
  base64Url: string
  mimeType: string
  id: string
}

export type IChatMessageFile = IChatMessagesPrivateFile | IChatMessagesPublicFile
