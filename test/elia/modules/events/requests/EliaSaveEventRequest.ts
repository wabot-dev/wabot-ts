import { param } from '@'

export class EliaSaveEventRequest {
  @param({
    description: 'Fecha y hora de inicio del evento',
  })
  dateTime: Date = new Date(NaN)

  @param({
    description: 'Duración del evento en minutos',
  })
  durationInMinutes: number = 0

  @param({
    description: 'Titulo del evento',
  })
  title: string = ''
}
