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

  getConnectionByChannel(channelName: string) {
    return this.data.connections.find((a) => a.channelName === channelName) ?? null
  }

  addConnection(connection: IChatConnection) {
    if (this.hasConnection(connection)) {
      throw new Error('Connection already exists')
    }
    this.data.connections.push(connection)
  }

  removeConnection(connection: IChatConnection) {
    const index = this.data.connections.findIndex(
      (c) => c.channelName === connection.channelName && c.id === connection.id,
    )
    if (index === -1) {
      throw new Error('Connection does not exist')
    }
    this.data.connections.splice(index, 1)
  }

  hasAssociation(association: IChatAssociation) {
    return this.data.associations?.some((a) => a.type === association.type && a.id === association.id) ?? false
  }

  hasAssociations(type: string) {
    return this.data.associations?.some((a) => a.type === type) ?? false
  }

  getAssociationsByType(type: string) {
    return this.data.associations?.filter((a) => a.type === type) ?? []
  }

  addAssociation(association: IChatAssociation) {
    if (this.hasAssociation(association)) {
      throw new Error('Association already exists')
    }
    if (!this.data.associations) this.data.associations = []
    this.data.associations.push(association)
  }

  removeAssociation(association: IChatAssociation) {
    if (!this.data.associations) {
      throw new Error('Association does not exist')
    }
    const index = this.data.associations.findIndex(
      (a) => a.type === association.type && a.id === association.id,
    )
    if (index === -1) {
      throw new Error('Association does not exist')
    }
    this.data.associations.splice(index, 1)
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
