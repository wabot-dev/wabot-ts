import { container, get, isNotEmpty, isString, restController, runRestControllers } from '@'
import { EliaEventRepository } from './repositories'

export class GetAllEventsRequest {
  @isString()
  @isNotEmpty()
  message: string = ''
}

@restController({ path: '/elia/event' })
export class EliaEventRestController {
  constructor(private eliaEventRepository: EliaEventRepository) {}

  @get()
  async allEvents(req: GetAllEventsRequest) {
    debugger
    const allEvents = await this.eliaEventRepository.findAll()
    return allEvents
  }
}

runRestControllers([EliaEventRestController], container)
