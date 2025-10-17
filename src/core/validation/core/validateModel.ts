import { IModelValidationResult, IModelValidatorsInfo } from './contracts'

export function validateModel<V>(
  value: any,
  info: IModelValidatorsInfo<V>,
): IModelValidationResult<V> {
  if (typeof value !== 'object' || value === null) {
    return { error: { description: 'Invalid object', properties: {} } }
  }

  let propertiesErrors: { [key: string]: string[] } = {}
  let resultValue = new info.modelConstructor() as any

  for (const propertyName in info.properties) {
    const propertyInfo = info.properties[propertyName]!
    const propertyValidators = propertyInfo.validators ?? []

    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(resultValue),
      propertyName,
    )

    const hasSetterOrWritable = !descriptor || descriptor.set || descriptor.writable

    const originalValue = value[propertyName]

    if (propertyInfo.isOptional && originalValue == null) {
      continue
    }

    let currentValue = originalValue

    if (resultValue[propertyName] == null && propertyInfo.isOptional) {
      resultValue[propertyName] = undefined
      continue
    }

    for (let propertyValidatorInfo of propertyValidators) {
      const propertyValidatorResult = propertyValidatorInfo.validator(
        currentValue,
        propertyValidatorInfo.validatorOptions,
      )

      currentValue = propertyValidatorResult.value

      if (propertyValidatorResult.error) {
        let propertyErrors = propertiesErrors[propertyName]
        if (!propertyErrors) {
          propertyErrors = []
          propertiesErrors[propertyName] = propertyErrors
        }
        propertyErrors.push(propertyValidatorResult.error.description)
      }
    }

    if (hasSetterOrWritable) {
      resultValue[propertyName] = currentValue
    }
  }

  if (Object.keys(propertiesErrors).length > 0) {
    return { error: { description: 'Invalid properties', properties: propertiesErrors } }
  }

  return { value: resultValue }
}
