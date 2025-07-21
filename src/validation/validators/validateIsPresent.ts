import { IValidationResult } from './contracts'

export function validateIsPresent(value: any): IValidationResult<any> {
  if (value == null) {
    return {
      error: { description: `not present` },
    }
  }

  return {
    value,
  }
}
