import { IValidationResult } from './contracts'

export function validateIsNotEmpty(value: any): IValidationResult<any> {
  if (value === '' || (Array.isArray(value) && value.length === 0)) {
    return {
      error: { description: `empty value not allowed` },
    }
  }

  return {
    value,
  }
}
