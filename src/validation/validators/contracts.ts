import { IConstructor } from '@/core'

export interface IValidationError {
  description: string
}

export interface IModelValidationError {
  model: IValidationError[]
  properties: { name: string; errors: IValidationError[] }[]
}

export interface IValidationResult<V> {
  value?: V
  error?: IValidationError
}

export interface IModelValidationResult<V> {
  value?: V
  error?: IModelValidationError
}

export type IValidator = (value: any, options: any) => IValidationResult<any>

export interface IPropertyValidatorInfo {
  propertyName: string
  validator: IValidator
  validatorOptions?: any
}

export type IModelValidatorsInfo<V> = {
  modelConstructor: IConstructor<V>
  properties: {
    [prop: string]: { isOptional?: boolean; validators?: IPropertyValidatorInfo[] } | undefined
  }
}
