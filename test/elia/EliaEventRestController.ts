import { container, get, isNotEmpty, isString, restController, runRestControllers } from '@'
import { EliaEventRepository } from './repositories'

export class GetAllEventsRequest {
  @isString()
  @isNotEmpty()
  message: string = ''
}

export class GetAllEventsRequestChild extends GetAllEventsRequest {}

@restController({ path: '/elia/event' })
export class EliaEventRestController {
  constructor(private eliaEventRepository: EliaEventRepository) {}

  @get()
  async allEvents(req: GetAllEventsRequestChild) {
    debugger
    const allEvents = await this.eliaEventRepository.findAll()
    return allEvents
  }
}

runRestControllers([EliaEventRestController])
