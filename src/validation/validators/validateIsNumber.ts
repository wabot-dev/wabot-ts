import { IValidationResult } from './contracts'

export function validateIsNumber(value: any): IValidationResult {
  if (typeof value !== 'number') {
    return {
      value,
      error: { description: `number value is required` },
    }
  }

  return {
    value,
  }
}
