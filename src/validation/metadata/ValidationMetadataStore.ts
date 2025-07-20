import { singleton } from '@/injection'
import { IValidatorMetadata } from './IValidatorMetadata'
import { IConstructor } from '@/core'
import { _IS_OPTIONAL_DUMMY_VALIDATOR_ } from './@isOptional'
import { IModelValidatorsInfo } from './IModelValidatorsInfo'

@singleton()
export class ValidationMetadataStore {
  private validators = new Map<Function, Map<string, IValidatorMetadata[]>>()

  saveValidatorMetadata(validatorMetadata: IValidatorMetadata) {
    let modelValidators = this.validators.get(validatorMetadata.modelConstructor)
    if (!modelValidators) {
      this.validators.set(validatorMetadata.modelConstructor, (modelValidators = new Map()))
    }
    let propertyValidators = modelValidators.get(validatorMetadata.propertyName)
    if (!propertyValidators) {
      propertyValidators = []
      modelValidators.set(validatorMetadata.propertyName, propertyValidators)
    }
    propertyValidators.unshift(validatorMetadata)
  }

  getModelValidatorsInfo(modelConstructor: IConstructor<any>) {
    const modelValidators: IModelValidatorsInfo = {
      modelConstructor: modelConstructor,
      properties: {},
    }

    ;[...(this.validators.get(modelConstructor)?.values() ?? [])].forEach(
      (propertyValidatorsMetadata) => {
        const propertyName = propertyValidatorsMetadata.at(0)?.propertyName
        if (!propertyName) {
          return
        }
        let propertyInfo = modelValidators.properties[propertyName]
        if (!propertyInfo) {
          propertyInfo = {}
          modelValidators.properties[propertyName] = propertyInfo
        }

        let validators = propertyInfo.validators
        if (!validators) {
          validators = []
          propertyInfo.validators = validators
        }

        propertyValidatorsMetadata.forEach((propertyValidatorMetadata) => {
          if (propertyValidatorMetadata.validator === _IS_OPTIONAL_DUMMY_VALIDATOR_) {
            propertyInfo.isOptional = true
          } else {
            validators.push(propertyValidatorMetadata)
          }
        })
      },
    )

    return modelValidators
  }
}
