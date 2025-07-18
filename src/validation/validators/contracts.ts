export interface IValidationError {
  description: string
}

export interface IValidationResult {
  value: any
  errors: IValidationError[]
}

export type IValidator = (value: any, options: any) => IValidationResult
