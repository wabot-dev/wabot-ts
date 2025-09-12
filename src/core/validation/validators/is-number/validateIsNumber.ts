import { IValidationResult } from '@/core/validation'

export function validateIsNumber(value: any): IValidationResult<number> {
  if (typeof value !== 'number') {
    return {
      error: { description: `number value is required` },
    }
  }

  return {
    value,
  }
}
