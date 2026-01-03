import { Entity, type IEntityData } from '@/core/entity'
import { IChatConnection } from './IChatConnection'
import { IChatType } from './IChatType'

export interface IChatAssociation {
  type: string
  id: string
}

export interface IChatData extends IEntityData {
  type: IChatType
  connections: IChatConnection[]
  associations?: IChatAssociation[]
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

  get associations() {
    return this.data.associations ?? []
  }

  hasConnection(connection: IChatConnection) {
    for (const con of this.data.connections) {
      if (con.channelName === connection.channelName && con.id === connection.id) {
        return true
      }
    }
    return false
  }

  hasAssociation(type: string, id: string) {
    return this.data.associations?.some((a) => a.type === type && a.id === id) ?? false
  }

  getAssociationsByType(type: string) {
    return this.data.associations?.filter((a) => a.type === type) ?? []
  }

  addAssociation(association: IChatAssociation) {
    if (this.hasAssociation(association.type, association.id)) {
      throw new Error('Association already exists')
    }
    if (!this.data.associations) this.data.associations = []
    this.data.associations.push(association)
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
