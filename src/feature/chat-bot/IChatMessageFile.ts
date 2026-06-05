export interface IChatMessagesPublicFile {
  name?: string
  publicUrl: string
  base64Url?: undefined
  mimeType: string
  id: string
  /** Text description of the file content, used to recall it without re-analyzing the binary. */
  description?: string
}

export interface IChatMessagesPrivateFile {
  name?: string
  publicUrl?: undefined
  base64Url: string
  mimeType: string
  id: string
  /** Text description of the file content, used to recall it without re-analyzing the binary. */
  description?: string
}

export type IChatMessageFile = IChatMessagesPrivateFile | IChatMessagesPublicFile
