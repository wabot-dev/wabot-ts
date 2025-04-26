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
}
