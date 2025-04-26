import { mindsetFunction, mindsetModule, type MessageContext } from '@'
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
    private context: MessageContext,
    private repository: EliaEventRepository,
  ) {}

  @mindsetFunction({
    description: 'Guarda un evento en el calendario',
  })
  async saveEvent(req: EliaSaveEventRequest) {
    const userId = this.context.user?.getId() ?? 'anonimus'

    const newEvent = new EliaEvent({
      userId,
      dateTime: req.dateTime,
      durationInMinutes: req.durationInMinutes,
      title: req.title,
    })

    await this.repository.save(newEvent)
    return JSON.stringify(newEvent)
  }
}
