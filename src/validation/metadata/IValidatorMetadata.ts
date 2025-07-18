import { IConstructor } from '@/core'
import { IValidator } from '../validators/contracts'

export interface IValidatorMetadata {
  modelConstructor: IConstructor<any>
  propertyName: string
  validator: IValidator
  validatorOptions?: any
}
