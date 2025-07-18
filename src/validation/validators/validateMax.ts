import { IValidationResult } from "./contracts"

export interface IValidateMaxOptions {
  limit: any
}

export function validateMax(value: any, options: IValidateMaxOptions): IValidationResult {
  if (value > options.limit) {
    return {
      value,
      errors: [{ description: `exceeds the established max limit` }],
    }
  }

  return {
    value,
    errors: [],
  }
}