export type IHubSpotWebhookEvent = IHubSpotConversationNewMessageEvent | IHubSpotUnknownEvent

export type IHubSpotWebhookEventBatch = IHubSpotWebhookEvent[]

export interface IHubSpotConversationNewMessageEvent {
  subscriptionType: 'conversation.creation' | 'conversation.newMessage'
  portalId: number
  appId?: number
  occurredAt: number
  objectId: string
  messageId?: string
  message?: IHubSpotConversationMessage
}

export interface IHubSpotConversationMessage {
  id: string
  threadId: string
  direction: 'INCOMING' | 'OUTGOING'
  channel?: string
  text?: string
  richText?: string
  from?: IHubSpotActor
  recipients?: IHubSpotActor[]
  attachments?: IHubSpotAttachment[]
}

export interface IHubSpotActor {
  actorId: string
  name?: string
  recipientField?: string
  senderField?: string
}

export interface IHubSpotAttachment {
  id: string
  name?: string
  mimeType?: string
  url?: string
  fileId?: string
}

export interface IHubSpotUnknownEvent {
  subscriptionType: string
  [key: string]: unknown
}
