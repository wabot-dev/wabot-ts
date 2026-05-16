import { isDate, isNotEmpty, isNumber, isString, max, min, mindsetModule } from '@'
import { description } from '@/core/description'
import { EliaEvent } from './EliaEvent'
import { EliaEventRepository } from './EliaEventRepository'

export class EliaSaveEventRequest {
  @isDate()
  @description('Fecha y hora de inicio del evento')
  dateTime: Date = new Date(NaN)

  @isNumber()
  @min(10)
  @max(240)
  @description('Duración del evento en minutos')
  durationInMinutes: number = 20

  @isString()
  @isNotEmpty()
  @description('Titulo del evento')
  title: string = ''

  @isString()
  @isNotEmpty()
  @description('Categoría del evento, autogenerar')
  category: string = ''
}

export class EliaReadEventsByCategoryRequest {
  @isString()
  @isNotEmpty()
  @description('Titulo del evento')
  category: string = ''
}

export class EliaReadUpcomingRequest {
  @isNumber()
  @min(1)
  @max(50)
  @description('Cantidad máxima de eventos a devolver')
  limit: number = 10
}

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
      category: req.category,
    })

    await this.repository.create(newEvent)
    return JSON.stringify(newEvent)
  }

  @description('Buscar eventos de una categoría')
  async readEventsByCategory(req: EliaReadEventsByCategoryRequest) {
    const result = await this.repository.findByCategory(req.category)
    return result
  }

  @description('Próximos eventos ordenados por fecha')
  async readUpcomingEvents(req: EliaReadUpcomingRequest) {
    return this.repository.findUpcoming(Date.now(), req.limit)
  }
}
