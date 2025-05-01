import type { IConstructor } from '@/core'
import { type IMindset } from '@/mindset'

export interface IChatBotMetadata {
  constructor: IConstructor<any>
  mindsetConstructor: IConstructor<IMindset>
  injectionToken: string
}
