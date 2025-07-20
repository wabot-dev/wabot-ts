import { IValidationResult } from './contracts'

export function validateIsNotEmpty(value: any): IValidationResult {
  if (value === '' || (Array.isArray(value) && value.length === 0)) {
    return {
      value,
      error: { description: `empty value not allowed` },
    }
  }

  return {
    value,
  }
}
