export interface IValidationError {
  description: string
}

export interface IValidationResult {
  value: any
  error?: IValidationError
}

export type IValidator = (value: any, options: any) => IValidationResult
