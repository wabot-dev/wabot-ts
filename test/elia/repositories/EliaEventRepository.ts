import { EliaEvent } from '../models/EliaEvent'

export class EliaEventRepository {
  save(item: EliaEvent): Promise<EliaEvent> {
    return new Promise((resolve) => {
      resolve(item)
    })
  }
}
