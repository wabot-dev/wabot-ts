import { IValidationResult } from './contracts'

export interface IValidateMaxOptions {
  limit: any
}

export function validateMax(value: any, options: IValidateMaxOptions): IValidationResult {
  if (value == null) {
    return {
      value,
      error: { description: `null or undefined value can't be validated with max` },
    }
  }

  if (Number(value) > Number(options.limit)) {
    return {
      value,
      error: { description: `exceeds the established max limit` },
    }
  }

  return {
    value,
  }
}
