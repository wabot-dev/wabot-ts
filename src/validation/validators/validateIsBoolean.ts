import { IValidationResult } from './contracts'

export function validateIsBoolean(value: any): IValidationResult<boolean> {
  if (typeof value !== 'boolean') {
    return {
      error: { description: `boolean value is required` },
    }
  }

  return {
    value,
  }
}
