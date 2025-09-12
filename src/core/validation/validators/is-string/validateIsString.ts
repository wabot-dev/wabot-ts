import { IValidationResult } from '@/core/validation'

export function validateIsString(value: any): IValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      error: { description: `string value is required` },
    }
  }

  return {
    value,
  }
}
