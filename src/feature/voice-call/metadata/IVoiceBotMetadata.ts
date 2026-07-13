import type { IConstructor } from '@/core/generics'
import { type IMindset } from '@/feature/mindset'

export interface IVoiceBotMetadata {
  constructor: IConstructor<any>
  mindsetConstructor: IConstructor<IMindset>
  injectionToken: string
}
