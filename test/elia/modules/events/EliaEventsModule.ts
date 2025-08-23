import { mindsetFunction, mindsetModule } from '@'
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
    private repository: EliaEventRepository,
  ) {}

  @mindsetFunction({
    description: 'Guarda un evento en el calendario',
  })
  async saveEvent(req: EliaSaveEventRequest) {
    const newEvent = new EliaEvent({
      userId: 'unknown',
      dateTime: req.dateTime.getTime(),
      durationInMinutes: req.durationInMinutes,
      title: req.title,
    })

    await this.repository.save(newEvent)
    return JSON.stringify(newEvent)
  }
}
