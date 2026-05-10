import { IConstructor } from '@/core/generics'
import { IChatAdapter } from '../IChatAdapter'

export interface IChatAdapterMetadata {
  constructor: IConstructor<IChatAdapter>
  provider: string
}
