import { IConstructor } from '@/core'
import { IValidationError } from './validators'
import { container } from '@/injection'
import { ValidationMetadataStore } from './metadata'

export interface IValidateModelResult {
  modelConstructor: IConstructor<any>
  value: any
  propertiesErrors: { name: string; errors: IValidationError[] }[]
  modelErrors: IValidationError[]
  hasErrors: boolean
}

export function validateModel(
  value: any,
  modelConstructor: IConstructor<any>,
): IValidateModelResult {
  debugger
  const metadataStore = container.resolve(ValidationMetadataStore)
  const info = metadataStore.getModelValidatorsInfo(modelConstructor)

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
    result.hasErrors = true
    return result
  }

  const validatedValue = new info.modelConstructor()

  for (const propertyName in info.properties) {
    const propertyInfo = info.properties[propertyName]!
    const propertyValidators = propertyInfo.validators ?? []

    let temPropertyValue = value[propertyName]
    if (temPropertyValue === undefined) {
      temPropertyValue = validatedValue[propertyName]
    }
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

  if (!result.hasErrors) {
    result.value = validatedValue
  }

  return result
}
