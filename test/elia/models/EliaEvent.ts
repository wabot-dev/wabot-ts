export interface IEliaEventData {
  id?: string
  personId: string
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
