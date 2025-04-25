import { type IMindset } from '@/mindset'
import { type IConstructor } from '@/shared'

export interface IChatBotMetadata {
  constructor: IConstructor<any>
  mindsetConstructor: IConstructor<IMindset>
  injectionToken: string
}
