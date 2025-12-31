import { IConstructor } from '@/core/generics'
import { ICronHandler } from './ICronHandler'
import { ICronJobScheduleConfig } from './ICronJobScheduleConfig'

export interface ICronMetadata {
  handlerConstructor: IConstructor<ICronHandler>
  config: ICronJobScheduleConfig
}
