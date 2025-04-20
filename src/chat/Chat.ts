export type IChatType = 'PRIVATE' | 'GROUP'

export interface IChatPrivateData {
  phone?: string
  email?: string
}

export interface IChatGroupData {
  channelType: string
  id: string
}

export interface IChatData {
  id?: string
  createdAt?: Date
  type: IChatType
  private?: IChatPrivateData
  group?: IChatGroupData
}

export class Chat {
  private data: IChatData

  constructor(data: IChatData) {
    this.data = data
  }

  private validatePrivateChat() {
    if (!this.data.private?.phone && !this.data.private?.email) {
      throw new Error('Should set phone or email for PRIVATE chat type')
    }
  }

  private validateGroupChat() {
    if (!this.data.group) {
      throw new Error('Should set group data')
    }
  }

  getId(): string {
    if (!this.data.id) {
      throw new Error('Chat ID is required')
    }
    return this.data.id
  }

  getPhone(): string | null {
    return this.data.private?.phone ?? null
  }

  getEmail(): string | null {
    return this.data.private?.email ?? null
  }

  getGroup(): IChatGroupData | null {
    return this.data.group ?? null
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
    if (this.data.type === 'PRIVATE') {
      this.validatePrivateChat()
    } else if (this.data.type === 'GROUP') {
      this.validateGroupChat()
    }
  }
}
