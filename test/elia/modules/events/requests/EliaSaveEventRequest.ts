import { isDate, isNotEmpty, isNumber, isString, max, min, param } from '@'

export class EliaSaveEventRequest {
  @param({
    description: 'Fecha y hora de inicio del evento',
  })
  @isDate()
  dateTime: Date = new Date(NaN)

  @param({
    description: 'Duración del evento en minutos',
  })
  @isNumber()
  @min(10)
  @max(240)
  durationInMinutes: number = 20

  @param({
    description: 'Titulo del evento',
  })
  @isString()
  @isNotEmpty()
  title: string = ''
}
