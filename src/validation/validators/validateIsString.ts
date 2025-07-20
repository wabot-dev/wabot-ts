import { IValidationResult } from './contracts'

export function validateIsString(value: any): IValidationResult {
  if (typeof value !== 'string') {
    return {
      value,
      error: { description: `string value is required` },
    }
  }

  return {
    value,
  }
}
