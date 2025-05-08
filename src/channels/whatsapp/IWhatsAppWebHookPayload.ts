export interface IWhatsAppWebhookPayload {
  object: 'whatsapp_business_account'
  entry: IEntry[]
}

interface IEntry {
  id: string
  changes: IChange[]
}

type IChange = IMessagesChange

interface IMessagesChange {
  value: IMessagesChangeValue
  field: 'messages'
}

interface IMessagesChangeValue {
  messaging_product: 'whatsapp'
  metadata: IMessageMetadata
  contacts?: IWhatsAppContact[]
  messages?: IWhatsAppMessage[]
}

export interface IMessageMetadata {
  display_phone_number: string
  phone_number_id: string
}

export interface IWhatsAppContact {
  profile: {
    name: string
  }
  wa_id: string
}

export type IWhatsAppMessage = ITextMessage | IAudioMessage

interface IBaseMessage {
  from: string
  id: string
  timestamp: string
  type: string
}

interface ITextMessage extends IBaseMessage {
  type: 'text'
  text: {
    body: string
  }
}

interface IAudioMessage extends IBaseMessage {
  type: 'audio'
  audio: {
    mime_type: string
    sha256: string
    id: string
    voice: boolean
  }
}
