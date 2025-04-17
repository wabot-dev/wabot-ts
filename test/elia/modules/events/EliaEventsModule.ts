import { mindsetFunction, mindsetModule, Context } from '@'
import { EliaEventRepository } from '../../repositories/EliaEventRepository'
import { EliaEvent } from '../../models/EliaEvent'
import { EliaSaveEventRequest } from './requests'

@mindsetModule({
  description: `
    Guarda un evento en el calendario de la persona 
    que le está hablando a Elia.
  `,
})
export class EliaEventsModule {
  constructor(
    private context: Context,
    private repository: EliaEventRepository,
  ) {}

  @mindsetFunction({
    description: 'Guarda un evento en el calendario de la persona que le está hablando a Elia',
  })
  async saveEvent(req: EliaSaveEventRequest) {
    const personId = await this.context.getPersonId()
    if (!personId) throw new Error('Person ID is required')

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
