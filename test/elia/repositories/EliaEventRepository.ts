import { injectable } from '@/injection'
import { EliaEvent } from '../models/EliaEvent'

@injectable()
export class EliaEventRepository {
  save(item: EliaEvent): Promise<EliaEvent> {
    return new Promise((resolve) => {
      resolve(item)
    })
  }
}
