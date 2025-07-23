import { IPersistentData, Persistent } from '@/core'

export interface IEliaEventData extends IPersistentData {
  userId: string
  title: string
  description?: string
  dateTime: number
  durationInMinutes: number
}

export class EliaEvent extends Persistent<IEliaEventData> {}
