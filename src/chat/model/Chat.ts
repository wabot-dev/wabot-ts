import { IChatType } from './IChatType'

export interface IChatData {
  id?: string
  createdAt?: Date
  type: IChatType
  mobile?: string
  sessionId?: string
}

export class Chat {
  private data: IChatData

  constructor(data: IChatData) {
    this.data = data
  }

  private validateSinglePerson() {
    if (!this.data.mobile && !this.data.sessionId) {
      throw new Error(
        'Either mobile or sessionId must be provided for SINGLE_PERSON chat type',
      )
    }
  }

  getMobile(): string | null {
    return this.data.mobile ?? null
  }

  getSessionId(): string | null {
    return this.data.sessionId ?? null
  }

  wasCreated(): boolean {
    return !!this.data.createdAt || !!this.data.id
  }

  validate() {
    if (!this.data.id) {  
      throw new Error('Chat ID is required')
    }
    if (!this.data.createdAt) {
      throw new Error('Chat createdAt is required')
    }
    if (this.data.type === 'SINGLE_PERSON') {
      this.validateSinglePerson()
    }
  }
}
