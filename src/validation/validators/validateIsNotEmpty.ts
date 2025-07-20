import { IValidationResult } from './contracts'

export function validateIsNotEmpty(value: any): IValidationResult {
  if (Number(value) === 0) {
    return {
      value,
      error: { description: `empty value not allowed` },
    }
  }

  return {
    value,
  }
}
