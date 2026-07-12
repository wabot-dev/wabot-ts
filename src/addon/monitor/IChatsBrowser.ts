export interface IChatAssociation {
  type: string
  id: string
}

export interface IChatSummary {
  id: string
  type: string
  channels: string[]
  associations: IChatAssociation[]
  createdAt: number
  lastActivity: number | null
  msgCount: number
}

export interface IChatThreadItem {
  id: string
  type: 'humanMessage' | 'botMessage' | 'functionCall'
  createdAt: number
  /** Raw discriminated IChatItem data ({humanMessage|botMessage|functionCall}). */
  data: any
}
