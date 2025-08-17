import { IConstructor } from '@/core'

export interface IValidationError {
  description: string
}

export interface IModelValidationError extends IValidationError {
  properties: { [key: string]: string[] }
}

export type IValidationResult<V> =
  | { value: V; error?: undefined }
  | {
      value?: undefined
      error: IValidationError
    }

export type IModelValidationResult<V> =
  | { value: V; error?: undefined }
  | {
      value?: undefined
      error: IModelValidationError
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
