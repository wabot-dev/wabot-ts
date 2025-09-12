import { IValidationResult } from '@/core/validation'

export function validateIsDate(value: any): IValidationResult<Date> {
  const _value = new Date(value)
  const time = _value.getTime()
  if (
    (typeof value !== 'number' && typeof value !== 'string' && !(value instanceof Date)) ||
    isNaN(time) ||
    time < 0
  ) {
    return {
      error: { description: `Date value is not valid` },
    }
  }

  return {
    value: _value,
  }
}
