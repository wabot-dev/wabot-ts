import { IValidationResult } from './contracts'

export interface IValidateMaxOptions {
  limit: any
}

export function validateMax(value: any, options: IValidateMaxOptions): IValidationResult<any> {
  if (value == null) {
    return {
      error: { description: `null or undefined value can't be validated with max` },
    }
  }

  if (Number(value) > Number(options.limit)) {
    return {
      error: { description: `exceeds the established max limit` },
    }
  }

  return {
    value,
  }
}
