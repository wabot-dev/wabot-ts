import { IValidationResult } from '@/core/validation'

export interface IValidateIsInOptions {
  values: readonly (number | string | boolean | null)[]
}

export function validateIsIn(value: any, options: IValidateIsInOptions): IValidationResult<any> {
  if (!options.values.includes(value)) {
    return {
      error: { description: `value not included in array` },
    }
  }

  return {
    value,
  }
}
