export type IChatType = 'PRIVATE' | 'GROUP'

export interface IChatConnection {
  chatType: IChatType
  channelName: string
  id: string
}

export interface IChatData {
  id?: string
  createdAt?: Date
  type: IChatType
  connections: IChatConnection[]
}


export class Chat {
  private data: IChatData

  constructor(data: IChatData) {
    this.data = data
  }

  isPrivate() {
    return this.data.type === 'PRIVATE'
  }

  isGroup() {
    return this.data.type === 'GROUP'
  }

  hasConnection(connection: IChatConnection) {
    for (const con of this.data.connections) {
      if (con.channelName === connection.channelName && con.id === connection.id) {
        return true
      }
    }
    return false
  }

  private validatePrivateChat() {
    if (this.data.connections.length < 1) {
      throw new Error('PRIVATE chat should have one or more connections')
    }
  }

  private validateGroupChat() {
    if (this.data.connections.length != 1) {
      throw new Error('GROUP chat should have exactly one connection')
    }
  }

  getId(): string {
    if (!this.data.id) {
      throw new Error('Chat ID is required')
    }
    return this.data.id
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
