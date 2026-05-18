export type IKapsoEvent = IKapsoMessageReceivedEvent | IKapsoUnknownEvent

export interface IKapsoUnknownEvent {
  event: string
  [key: string]: unknown
}

export interface IKapsoMessageReceivedEvent {
  event: 'whatsapp.message.received'
  message: IKapsoIncomingMessage
  conversation: IKapsoConversation
  is_new_conversation?: boolean
  phone_number_id?: string
}

export interface IKapsoIncomingMessage {
  id: string
  timestamp: string
  type: string
  from: string
  from_user_id?: string
  from_parent_user_id?: string
  username?: string
  text?: { body: string }
}

export interface IKapsoConversation {
  id: string
  phone_number?: string
  business_scoped_user_id?: string
  parent_business_scoped_user_id?: string
  username?: string
  status?: string
  phone_number_id?: string
  kapso?: {
    contact_name?: string
    [key: string]: unknown
  }
}
