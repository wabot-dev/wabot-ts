import { MindsetFunction } from '@/mindset'
import { Transform } from 'class-transformer'
import {
  IsISO8601,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator'
import { EliaEventRepository } from '../repositories/EliaEventRepository'
import { EliaEvent } from '../models/EliaEvent'
import { Context } from '@/context'

export class EliaSaveEventParams {
  @IsISO8601()
  @Transform(({ value }) => new Date(value))
  dateTime: Date

  @IsNumberString()
  @Transform(({ value }) => parseInt(value))
  durationInMinutes: number

  @IsString()
  @IsNotEmpty()
  title: string
}

@MindsetFunction({
  description: `
    Guarda un evento en el calendario de la persona 
    que le está hablando a Elia.
  `,
})
export class EliaSaveEvent {
  constructor(
    private context: Context,
    private repository: EliaEventRepository,
  ) {}

  async execute(params: EliaSaveEventParams) {
    const personId = await this.context.getPersonId()
    if (!personId) throw new Error('Person ID is required')

    const newEvent = new EliaEvent({
      personId,
      dateTime: params.dateTime,
      durationInMinutes: params.durationInMinutes,
      title: params.title,
    })

    await this.repository.save(newEvent)
    return JSON.stringify(newEvent)
  }
}
