import { IModelValidationResult, IModelValidatorsInfo, IValidationError } from './contracts'

export function validateModel<V>(
  value: any,
  info: IModelValidatorsInfo<V>,
): IModelValidationResult<V> {
  if (typeof value !== 'object' || value === null) {
    return { error: { description: 'Invalid object', properties: {} } }
  }

  let propertiesErrors: { [key: string]: IValidationError[] } = {}
  let resultValue = new info.modelConstructor() as any

  const properties: string[] = []
  const getters: string[] = []

  for (const propertyName in info.properties) {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(resultValue),
      propertyName,
    )
    if (descriptor?.get) {
      getters.push(propertyName)
    }
    if (!descriptor?.set && !descriptor?.get) {
      properties.push(propertyName)
    }
  }

  for (const propertyName of properties) {
    const propertyInfo = info.properties[propertyName]!
    const propertyValidators = propertyInfo.validators ?? []

    let currentPropValue = propertyInfo.isOptional
      ? (value[propertyName] ?? resultValue[propertyName])
      : value[propertyName]

    if (currentPropValue == null && propertyInfo.isOptional) {
      resultValue[propertyName] = undefined
      continue
    }

    for (let propertyValidatorInfo of propertyValidators) {
      const propertyValidatorResult = propertyValidatorInfo.validator(
        currentPropValue,
        propertyValidatorInfo.validatorOptions,
      )

      if (propertyValidatorResult.error) {
        let propertyErrors = propertiesErrors[propertyName]
        if (!propertyErrors) {
          propertyErrors = []
          propertiesErrors[propertyName] = propertyErrors
        }
        propertyErrors.push(propertyValidatorResult.error)
      } else {
        currentPropValue = propertyValidatorResult.value
      }
    }
    resultValue[propertyName] = currentPropValue
  }

  for (const propertyName of getters) {
    const propertyInfo = info.properties[propertyName]!
    const propertyValidators = propertyInfo.validators ?? []

    let propValue = resultValue[propertyName]

    if (propValue == null && propertyInfo.isOptional) {
      continue
    }

    for (let propertyValidatorInfo of propertyValidators) {
      const propertyValidatorResult = propertyValidatorInfo.validator(
        propValue,
        propertyValidatorInfo.validatorOptions,
      )

      if (propertyValidatorResult.error) {
        let propertyErrors = propertiesErrors[propertyName]
        if (!propertyErrors) {
          propertyErrors = []
          propertiesErrors[propertyName] = propertyErrors
        }
        propertyErrors.push(propertyValidatorResult.error)
      }
    }
  }

  if (Object.keys(propertiesErrors).length > 0) {
    return { error: { description: 'Invalid properties', properties: propertiesErrors } }
  }

  return { value: resultValue }
}
