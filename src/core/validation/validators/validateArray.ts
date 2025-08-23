import { IArrayValidationResult, IValidator } from './contracts'

export interface IValidateArrayOptions {}

export interface IValidateArrayOptionsWithItemsValidators extends IValidateArrayOptions {
  itemsValidator?: { validator: IValidator; options: any }[]
}

export function validateArray(
  value: any,
  options?: IValidateArrayOptionsWithItemsValidators,
): IArrayValidationResult<any> {
  if (!Array.isArray(value)) {
    return {
      error: { description: 'Should be an array', items: [] },
    }
  }

  const { itemsValidator } = options ?? {}

  const valueOut = []
  const errorItems = []
  for (const item of value) {
    let itemOut = item
    const itemErrors = []

    for (const itemValidator of itemsValidator ?? []) {
      const { error, value } = itemValidator.validator(itemOut, itemValidator.options)
      if (error) {
        itemErrors.push(error)
      } else {
        itemOut = value
      }
    }

    if (itemErrors.length == 0) {
      valueOut.push(itemOut)
      errorItems.push(null)
    } else {
      valueOut.push(null)
      errorItems.push(itemErrors)
    }
  }

  if (errorItems.some((x) => x != null)) {
    return {
      error: { description: 'Error on some items', items: errorItems },
    }
  }

  return {
    value: valueOut,
  }
}
