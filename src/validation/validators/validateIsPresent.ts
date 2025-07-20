import { IValidationResult } from './contracts'

export function validateIsPresent(value: any): IValidationResult {
  if (value == null) {
    return {
      value,
      error: { description: `not present` },
    }
  }

  return {
    value,
  }
}
