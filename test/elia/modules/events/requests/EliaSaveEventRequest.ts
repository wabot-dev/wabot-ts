import { isDate, isNotEmpty, isNumber, isString, max, min } from '@'
import { description } from '@/core/description'

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
}
