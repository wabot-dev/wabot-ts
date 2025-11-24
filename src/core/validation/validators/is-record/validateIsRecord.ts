import { IValidationResult } from '@/core/validation'

export interface IValidateIsRecordOptions {
  keyType: 'string' | 'number'
  valueType: 'string' | 'number' | 'boolean'
}

export function validateIsRecord(
  value: any,
  options: IValidateIsRecordOptions,
): IValidationResult<any> {
  if (value == null) {
    return {
      error: { description: `null is not allowed` },
    }
  }

  if (typeof value !== 'object') {
    return {
      error: { description: `value should be an object` },
    }
  }

  if (Array.isArray(value)) {
    return {
      error: { description: `array is not allowed` },
    }
  }

  for (const key in value) {
    if (typeof key !== options.keyType) {
      return {
        error: { description: `record keys should be ${options.keyType}` },
      }
    }

    const keyValue = value[key]
    if (typeof keyValue !== options.valueType) {
      return {
        error: { description: `record values should be ${options.valueType}` },
      }
    }
  }

  return {
    value,
  }
}
