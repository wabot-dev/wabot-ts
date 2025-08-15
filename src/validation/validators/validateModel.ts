import { IModelValidationResult, IModelValidatorsInfo } from './contracts'

export function validateModel<V>(
  value: any,
  info: IModelValidatorsInfo<V>,
): IModelValidationResult<V> {
  const result: IModelValidationResult<V> = {}

  if (typeof value !== 'object') {
    result.error = {
      description: 'the value should be an object',
      properties: [],
    }
    return result
  }

  const validatedValue = new info.modelConstructor() as any

  for (const propertyName in info.properties) {
    const propertyInfo = info.properties[propertyName]!
    const propertyValidators = propertyInfo.validators ?? []

    validatedValue[propertyName] = value[propertyName] ?? validatedValue[propertyName]

    if (validatedValue[propertyName] == null && propertyInfo.isOptional) {
      validatedValue[propertyName] = null
      continue
    }

    for (let propertyValidatorInfo of propertyValidators) {
      const propertyValidatorResult = propertyValidatorInfo.validator(
        validatedValue[propertyName],
        propertyValidatorInfo.validatorOptions,
      )
      validatedValue[propertyName] = propertyValidatorResult.value
      if (propertyValidatorResult.error) {
        let resultError = result.error
        if (!resultError) {
          resultError = { description: `Error on properties`, properties: [] }
          result.error = resultError
        }

        let propertyErrors = resultError.properties.find((x) => x.name === propertyName)
        if (!propertyErrors) {
          propertyErrors = { name: propertyName, errors: [] }
          resultError.properties.push(propertyErrors)
        }

        propertyErrors.errors.push(propertyValidatorResult.error)
      }
    }
  }

  if (!result.error) {
    result.value = validatedValue
  }

  return result
}
