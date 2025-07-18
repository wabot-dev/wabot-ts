import { IConstructor } from '@/core'
import { IModelValidatorsInfo } from './metadata/IModelValidatorsInfo'
import { IValidationError } from './validators'

export interface IValidateModelResult {
  modelConstructor: IConstructor<any>
  value: any
  propertiesErrors: { name: string; errors: IValidationError[] }[]
  modelErrors: IValidationError[]
  hasErrors: boolean
}

export function validateModel(value: any, info: IModelValidatorsInfo): IValidateModelResult {
  const result: IValidateModelResult = {
    modelConstructor: info.modelConstructor,
    propertiesErrors: [],
    modelErrors: [],
    hasErrors: false,
    value: undefined,
  }

  if (typeof value !== 'object') {
    result.modelErrors.push({
      description: `the value should be an object`,
    })
    return result
  }

  const validatedValue = new info.modelConstructor()

  for (const propertyName in info.properties) {
    const propertyInfo = info.properties[propertyName]!
    const propertyValidators = propertyInfo.validators ?? []

    let temPropertyValue = value[propertyName]
    let propertyHasError = false
    for (let propertyValidatorInfo of propertyValidators) {
      const propertyValidatorResult = propertyValidatorInfo.validator(
        temPropertyValue,
        propertyValidatorInfo.validatorOptions,
      )
      if (propertyValidatorResult.error) {
        propertyHasError = true
        let propertyErrors = result.propertiesErrors.find((x) => x.name === propertyName)
        if (!propertyErrors) {
          propertyErrors = { name: propertyName, errors: [] }
          result.propertiesErrors.push(propertyErrors)
        }

        propertyErrors.errors.push(propertyValidatorResult.error)
      }
      temPropertyValue = propertyValidatorResult.value
    }
    if (propertyHasError) {
      result.hasErrors = true
    } else {
      validatedValue[propertyName] = temPropertyValue
    }
  }

  return result
}
