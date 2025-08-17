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

    resultValue[propertyName] = value[propertyName] ?? resultValue[propertyName]

    if (resultValue[propertyName] == null && propertyInfo.isOptional) {
      resultValue[propertyName] = null
      continue
    }

    for (let propertyValidatorInfo of propertyValidators) {
      const propertyValidatorResult = propertyValidatorInfo.validator(
        resultValue[propertyName],
        propertyValidatorInfo.validatorOptions,
      )

      if (propertyValidatorResult.error) {
        let propertyErrors = propertiesErrors[propertyName]
        if (!propertyErrors) {
          propertyErrors = []
          propertiesErrors[propertyName] = propertyErrors
        }
        propertyErrors.push(propertyValidatorResult.error.description)
      } else {
        resultValue[propertyName] = propertyValidatorResult.value
      }
    }
  }

  if (Object.keys(propertiesErrors).length > 0) {
    return { error: { description: 'Invalid properties', properties: propertiesErrors } }
  }

  return { value: resultValue }
}
