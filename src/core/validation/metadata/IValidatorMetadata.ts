import { IConstructor } from '@/core/generics'
import { IValidator } from '../core/contracts'

export interface IValidatorMetadata {
  modelConstructor: IConstructor<any>
  propertyName: string
  validator: IValidator
  validatorOptions?: any
  typeDescriptor?: string
}
