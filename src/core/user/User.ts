import { Entity, type IEntityData } from '../Entity'
import { IStorableData } from '../Storable'

export interface IUserConnection extends IStorableData {
  channelName: string
  id: string
}

export interface IUserData extends IEntityData {
  shortName: string
  connections: IUserConnection[]
  keyValueData: { [key: string]: string }
}

export class User extends Entity<IUserData> {
  constructor(data: IUserData) {
    super(data)
  }

  hasConnection(connection: IUserConnection) {
    for (const con of this.data.connections) {
      if (con.channelName === connection.channelName && con.id === connection.id) {
        return true
      }
    }
    return false
  }

  getValue(key: string) {
    return this.data.keyValueData[key]
  }

  setValue(key: string, value: string) {
    this.data.keyValueData[key] = value
  }

  addConnection(connection: IUserConnection) {
    this.data.connections.push(connection)
  }
}
