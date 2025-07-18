import { IConstructor } from '@/core'
import { IValidatorMetadata } from './IValidatorMetadata'

export type IModelValidatorsInfo = {
  modelConstructor: IConstructor<any>
  properties: {
    [prop: string]: { isOptional?: boolean; validators?: IValidatorMetadata[] } | undefined
  }
}
