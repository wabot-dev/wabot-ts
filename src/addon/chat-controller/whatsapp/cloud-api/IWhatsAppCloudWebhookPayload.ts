export interface IWhatsAppCloudWebhookPayload {
  object: 'whatsapp_business_account'
  entry: IWhatsAppCloudEntry[]
}

interface IWhatsAppCloudEntry {
  id: string
  changes: IWhatsAppCloudChange[]
}

type IWhatsAppCloudChange = IWhatsAppCloudMessagesChange

interface IWhatsAppCloudMessagesChange {
  value: IWhatsAppCloudMessagesChangeValue
  field: 'messages'
}

interface IWhatsAppCloudMessagesChangeValue {
  messaging_product: 'whatsapp'
  metadata: IWhatsAppCloudMessageMetadata
  contacts?: IWhatsAppCloudContact[]
  messages?: IWhatsAppCloudMessage[]
}

export interface IWhatsAppCloudMessageMetadata {
  display_phone_number: string
  phone_number_id: string
}

export interface IWhatsAppCloudContact {
  profile: {
    name: string
  }
  wa_id: string
}

export type IWhatsAppCloudMessage = IWhatsAppCloudTextMessage | IWhatsAppCloudAudioMessage

interface IWhatsAppCloudBaseMessage {
  from: string
  id: string
  timestamp: string
  type: string
}

interface IWhatsAppCloudTextMessage extends IWhatsAppCloudBaseMessage {
  type: 'text'
  text: {
    body: string
  }
}

interface IWhatsAppCloudAudioMessage extends IWhatsAppCloudBaseMessage {
  type: 'audio'
  audio: {
    mime_type: string
    sha256: string
    id: string
    voice: boolean
  }
}
