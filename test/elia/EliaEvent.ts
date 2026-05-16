import { IEntityData, Entity } from '@'

export interface IEliaEventData extends IEntityData {
  userId: string
  title: string
  description?: string
  dateTime: number
  durationInMinutes: number
  category?: string
}

export class EliaEvent extends Entity<IEliaEventData> {}
