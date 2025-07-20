import { IValidationResult } from './contracts'

export function validateIsBoolean(value: any): IValidationResult {
  if (typeof value !== 'boolean') {
    return {
      value,
      error: { description: `boolean value is required` },
    }
  }

  return {
    value,
  }
}
