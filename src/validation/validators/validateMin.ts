import { IValidationResult } from './contracts'

export interface IValidateMinOptions {
  limit: any
}

export function validateMin(value: any, options: IValidateMinOptions): IValidationResult<any> {
  if (value == null) {
    return {
      error: { description: `null or undefined value can't be validated with min` },
    }
  }

  if (Number(value) < Number(options.limit)) {
    return {
      error: { description: `exceeds the established min limit` },
    }
  }

  return {
    value,
  }
}
