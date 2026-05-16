import { EliaEvent } from './EliaEvent'

export interface IEliaEventPgQueries {
  findUpcoming(fromMillis: number, limit: number): Promise<EliaEvent[]>
  findByUserInRange(userId: string, fromMillis: number, toMillis: number): Promise<EliaEvent[]>
}
