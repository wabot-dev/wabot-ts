import { IValidationResult } from "./contracts"

export function validateIsNotEmpty(value: any): IValidationResult {
  if (!value) {
    return {
      value,
      errors: [{ description: `empty value not allowed` }],
    }
  }

  return {
    value,
    errors: [],
  }
}
