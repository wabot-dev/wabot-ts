import { IValidationResult } from './contracts'

export function validateIsNotEmpty(value: any): IValidationResult {
  if (!value) {
    return {
      value,
      error: { description: `empty value not allowed` },
    }
  }

  return {
    value,
  }
}
