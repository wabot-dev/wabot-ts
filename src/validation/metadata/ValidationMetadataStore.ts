import { singleton } from '@/injection'
import { IValidatorMetadata } from './IValidatorMetadata'
import { IConstructor } from '@/core'
import { IModelValidatorsInfo, IPropertyValidatorInfo } from '../validators/contracts'
import { _IS_OPTIONAL_DUMMY_VALIDATOR_ } from '../validators/validateIsOptional'

function getClassHierarchy(cls: Function): Function[] {
  const classes: Function[] = []
  let proto = Object.getPrototypeOf(cls.prototype)

  while (proto && proto.constructor !== Object) {
    classes.push(proto.constructor)
    proto = Object.getPrototypeOf(proto)
  }

  return classes
}

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

  getModelValidatorsInfo<V>(modelConstructor: IConstructor<V>): IModelValidatorsInfo<V> {
    const constructors = getClassHierarchy(modelConstructor)
    constructors.unshift(modelConstructor)

    const modelValidators: IModelValidatorsInfo<V> = {
      modelConstructor: modelConstructor,
      properties: Object.assign(
        {},
        ...constructors.map((x) => this.getConstructorPropertiesValidatorsInfo(x as any)),
      ),
    }

    return modelValidators
  }

  private getConstructorPropertiesValidatorsInfo(modelConstructor: IConstructor<any>) {
    const properties: {
      [prop: string]: { isOptional?: boolean; validators?: IPropertyValidatorInfo[] } | undefined
    } = {}

    ;[...(this.validators.get(modelConstructor)?.values() ?? [])].forEach(
      (propertyValidatorsMetadata) => {
        const propertyName = propertyValidatorsMetadata.at(0)?.propertyName
        if (!propertyName) {
          return
        }
        let propertyInfo = properties[propertyName]
        if (!propertyInfo) {
          propertyInfo = {}
          properties[propertyName] = propertyInfo
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

    return properties
  }
}
