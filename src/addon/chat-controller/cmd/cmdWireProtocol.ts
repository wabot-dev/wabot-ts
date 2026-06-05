export interface ICmdChannelEntry {
  route: string
}

export interface ICmdImage {
  name?: string
  mimeType: string
  /** Data URL: `data:<mimeType>;base64,<...>`. */
  base64Url: string
}

export type CmdClientMessage =
  | { type: 'hello' }
  | { type: 'select'; route: string }
  | { type: 'message'; text?: string; images?: ICmdImage[] }
  | { type: 'clear' }

export type CmdServerMessage =
  | { type: 'channels'; list: ICmdChannelEntry[] }
  | { type: 'selected'; route: string }
  | { type: 'reply'; senderName?: string; text: string }
  | { type: 'cleared'; route: string }
  | { type: 'error'; message: string }
