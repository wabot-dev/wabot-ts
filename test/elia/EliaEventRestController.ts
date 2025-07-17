import { get, restController } from '@'
import { EliaEventRepository } from './repositories'

@restController({ path: '/elia/event' })
export class EliaEventRestController {
  constructor(private eliaEventRepository: EliaEventRepository) {}

  @get()
  async allEvents() {
    const allEvents = await this.eliaEventRepository.findAll()
    return allEvents
  }
}
