import { mindsetModule } from '@'
import { description } from '@/core/description'
import { EliaEvent } from '../../models/EliaEvent'
import { EliaEventRepository } from '../../repositories/EliaEventRepository'
import { EliaSaveEventRequest } from './requests'

@mindsetModule()
export class EliaEventsModule {
  constructor(private repository: EliaEventRepository) {}

  @description('Guarda un evento en el calendario')
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
