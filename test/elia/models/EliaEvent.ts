export interface IEliaEventData {
  id?: string
  createdAt?: Date
  userId: string
  title: string
  description?: string
  dateTime: Date
  durationInMinutes: number
}

export class EliaEvent {
  private data: IEliaEventData

  constructor(data: IEliaEventData) {
    this.data = data
  }
}
