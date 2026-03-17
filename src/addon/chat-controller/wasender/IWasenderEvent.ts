export type IWasenderEvent = IWasenderMessageReceivedEvent | IWasenderQrUpdatedEvent

export interface IWasenderQrUpdatedEvent {
  event: 'qrcode.updated'
}

export interface IWasenderMessageReceivedEvent {
  event: 'messages.received'
  sessionId: string
  data: {
    messages: IWasenderMessageReceivedData | IWasenderMessageReceivedData[]
  }
  timestamp: number
}

export interface IWasenderMessageReceivedData {
  key: IWasenderMessageKey
  messageTimestamp: number
  pushName: string
  broadcast: boolean
  message: IWasenderMessageContent
  remoteJid: string
  id: string
}

export interface IWasenderMessageKey {
  remoteJid: string
  fromMe: boolean
  id: string
  senderLid: string
  senderPn?: string
  cleanedSenderPn?: string
}

export interface IWasenderMessageContent {
  conversation: string
  messageContextInfo: IWasenderMessageContextInfo
}

export interface IWasenderMessageContextInfo {
  deviceListMetadata: IWasenderDeviceListMetadata
  deviceListMetadataVersion: number
  messageSecret: string
}

export interface IWasenderDeviceListMetadata {
  senderKeyHash: string
  senderTimestamp: string
  recipientKeyHash: string
  recipientTimestamp: string
}
