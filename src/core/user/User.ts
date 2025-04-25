
export interface IUserConnection {
  channelName: string
  id: string
}

export interface IUserData {
  id?: string
  createdAt?: Date
  connections: IUserConnection[]
}

export interface IUser {
  getId(): string
}

export class User {

}