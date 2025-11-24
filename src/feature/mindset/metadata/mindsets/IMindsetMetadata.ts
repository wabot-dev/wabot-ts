import { IConstructor } from '@/core/generics'
import { type IMindsetConfig } from './IMindsetConfig'
import { IMindset } from '../../IMindset'

export interface IMindsetMetadata {
  constructor: IConstructor<IMindset>
  config?: IMindsetConfig
}
