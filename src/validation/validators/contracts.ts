import { IConstructor } from '@/core'

export interface IValidationError {
  description: string
}

export interface IModelValidationError extends IValidationError {
  properties: { [key: string]: string[] }
}

export interface IArrayValidationError extends IValidationError {
  items: (IValidationError[] | null)[]
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

export type IArrayValidationResult<V> =
  | { value: V[]; error?: undefined }
  | {
      value?: undefined
      error: IArrayValidationError
    }

export type IValidator<V = any, O = any> = (value: V, options: O) => IValidationResult<V>

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
