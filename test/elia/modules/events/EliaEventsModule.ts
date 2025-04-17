import { mindsetFunction, mindsetModule, Context } from '@'
import { EliaEventRepository } from '../../repositories/EliaEventRepository'
import { EliaEvent } from '../../models/EliaEvent'
import { EliaSaveEventRequest } from './requests'

@mindsetModule({
  description: `
    Modulo para administrar eventos en el calendario.
  `,
})
export class EliaEventsModule {
  constructor(
    private context: Context,
    private repository: EliaEventRepository,
  ) {}

  @mindsetFunction({
    description: 'Guarda un evento en el calendario',
  })
  async saveEvent(req: EliaSaveEventRequest) {
    const personId = this.context.getUserId()

    const newEvent = new EliaEvent({
      personId,
      dateTime: req.dateTime,
      durationInMinutes: req.durationInMinutes,
      title: req.title,
    })

    await this.repository.save(newEvent)
    return JSON.stringify(newEvent)
  }
}
