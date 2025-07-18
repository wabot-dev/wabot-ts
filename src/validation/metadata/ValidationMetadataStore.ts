import { singleton } from '@/injection'
import { IValidatorMetadata } from './IValidatorMetadata'
import { IConstructor } from '@/core'
import { _IS_OPTIONAL_DUMMY_VALIDATOR_ } from './@isOptional'

@singleton()
export class ValidationMetadataStore {
  private validators = new Map<Function, Map<string, IValidatorMetadata>>()

  saveValidatorMetadata(validatorMetadata: IValidatorMetadata) {
    let modelValidators = this.validators.get(validatorMetadata.modelConstructor)
    if (!modelValidators) {
      this.validators.set(validatorMetadata.modelConstructor, (modelValidators = new Map()))
    }
    modelValidators.set(validatorMetadata.propertyName, validatorMetadata)
  }

  getModelValidatorsInfo(model: IConstructor<any>) {
    const modelValidators: {
      [prop: string]: { isOptional?: boolean; validators?: IValidatorMetadata[] } | undefined
    } = {}

    ;[...(this.validators.get(model)?.values() ?? [])].forEach((validatorMetadata) => {
      let propertyInfo = modelValidators[validatorMetadata.propertyName]
      if (!propertyInfo) {
        propertyInfo = {}
        modelValidators[validatorMetadata.propertyName] = propertyInfo
      }

      let validators = propertyInfo.validators
      if (!validators) {
        validators = []
        propertyInfo.validators = validators
      }

      if (validatorMetadata.validator === _IS_OPTIONAL_DUMMY_VALIDATOR_) {
        propertyInfo.isOptional = true
      } else {
        validators.push(validatorMetadata)
      }
    })

    return modelValidators
  }
}
