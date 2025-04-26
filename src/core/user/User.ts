export interface IUserConnection {
  channelName: string
  id: string
}

export interface IUserData {
  id?: string
  createdAt?: Date
  connections: IUserConnection[]
}

export class User {
  constructor(private data: IUserData) {}

  getId() {
    if (!this.data.id) {
      throw new Error('User have not ID')
    }
    return this.data.id
  }

  hasConnection(connection: IUserConnection) {
    for (const con of this.data.connections) {
      if (con.channelName === connection.channelName && con.id === connection.id) {
        return true
      }
    }
    return false
  }

  wasCreated(): boolean {
    return !!this.data.createdAt || !!this.data.id
  }

  validate() {
    if (!this.data.id) {
      throw new Error('User ID is required')
    }
    if (!this.data.createdAt) {
      throw new Error('User createdAt is required')
    }
  }
}
