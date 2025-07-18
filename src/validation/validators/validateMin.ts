import { IValidationResult } from './contracts'

export interface IValidateMinOptions {
  limit: any
}

export function validateMin(value: any, options: IValidateMinOptions): IValidationResult {
  if (value < options.limit) {
    return {
      value,
      error: { description: `exceeds the established min limit` },
    }
  }

  return {
    value,
  }
}
