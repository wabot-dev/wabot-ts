import { Entity, type IEntityData } from '@/core/entity'
import { IChatConnection } from './IChatConnection'
import { IChatType } from './IChatType'

export interface IChatData extends IEntityData {
  type: IChatType
  connections: IChatConnection[]
}

export class Chat extends Entity<IChatData> {
  constructor(data: IChatData) {
    super(data)
  }

  isPrivate() {
    return this.data.type === 'PRIVATE'
  }

  isGroup() {
    return this.data.type === 'GROUP'
  }

  get connections() {
    return this.data.connections
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

  override validate() {
    super.validate()
    if (this.data.type === 'PRIVATE') {
      this.validatePrivateChat()
    } else if (this.data.type === 'GROUP') {
      this.validateGroupChat()
    }
  }
}
