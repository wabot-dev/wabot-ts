import type { IConstructor } from '@/core/generics'
import { type IMindset } from '@/feature/mindset'

export interface IChatBotMetadata {
  constructor: IConstructor<any>
  mindsetConstructor: IConstructor<IMindset>
  injectionToken: string
}
