export interface ICmdChannelEntry {
  route: string
}

export type CmdClientMessage =
  | { type: 'hello' }
  | { type: 'select'; route: string }
  | { type: 'message'; text: string }

export type CmdServerMessage =
  | { type: 'channels'; list: ICmdChannelEntry[] }
  | { type: 'selected'; route: string }
  | { type: 'reply'; senderName?: string; text: string }
  | { type: 'error'; message: string }
