import { singleton } from '@/core/injection'

import { type IMindsetModuleMetadata } from './modules/IMindsetModuleMetadata'

import { type IMindsetMetadata } from './mindsets/IMindsetMetadata'
import { DescriptionMetadataStore } from '@/core/description'
import { IConstructor } from '@/core/generics'
import { ValidationMetadataStore } from '@/core/validation'
import { IMindset } from '../IMindset'

@singleton()
export class MindsetMetadataStore {
  private readonly modules = new Map<Function, IMindsetModuleMetadata>()
  private readonly mindsets = new Map<Function, IMindsetMetadata>()

  constructor(
    private descriptionMetadataStore: DescriptionMetadataStore,
    private validationMetadataStore: ValidationMetadataStore,
  ) {}

  public saveModuleMetadata(metadata: IMindsetModuleMetadata): void {
    this.modules.set(metadata.constructor, metadata)
  }

  public saveMindsetMetadata(metadata: IMindsetMetadata): void {
    this.mindsets.set(metadata.constructor, metadata)
  }

  public getModuleInfo(moduleCtor: IConstructor<any>) {
    const module = this.modules.get(moduleCtor)
    if (!module) {
      throw new Error(`not found mindsetModule info for ${moduleCtor.name}`)
    }

    const descriptions = this.descriptionMetadataStore.getModelDescriptions(moduleCtor)
    const functions = descriptions.filter((x) => x.propertyType === Function)

    return {
      config: module.config,
      functions: functions.map((x) => {
        if (x.functionArgsTypes && x.functionArgsTypes.length > 1) {
          throw new Error(
            `invalid mindset function ${x.propertyName}, should have none or one object parámeter`,
          )
        }

        const functionArgsModel =
          x.functionArgsTypes && x.functionArgsTypes.length === 1 ? x.functionArgsTypes[0] : null

        const argsDescriptions =
          (functionArgsModel &&
            this.descriptionMetadataStore.getModelDescriptions(functionArgsModel as any)) ??
          []

        const functionArgsModelValidatorsInfo =
          functionArgsModel &&
          this.validationMetadataStore.getModelValidatorsInfo(functionArgsModel as any)

        const argsValidators = functionArgsModelValidatorsInfo?.properties ?? {}

        const argsDescriptionsWithTypes = argsDescriptions.map((argDescription) => {
          const argValidator = argsValidators[argDescription.propertyName]
          const typeValidator = argValidator?.validators?.find((x) => x.typeDescriptor)
          const typeDescriptor = typeValidator?.typeDescriptor

          if (!typeDescriptor) {
            throw new Error(
              `the property '${argDescription.constructor.name}.${argDescription.propertyName}' should have a type validator`,
            )
          }

          return { ...argDescription, typeDescriptor }
        })

        if (argsDescriptions.length !== Object.keys(argsValidators).length) {
          throw new Error(`the model '${moduleCtor.name}' have properties without descriptions`)
        }

        return {
          moduleConstructor: moduleCtor,
          function: x,
          name: x.propertyName,
          description: x.description,
          argsDescriptions: argsDescriptionsWithTypes,
          argsValidatorsInfo: functionArgsModelValidatorsInfo,
        }
      }),
    }
  }

  public getMindsetInfo(mindsetCtor: IConstructor<IMindset>) {
    const mindset = this.mindsets.get(mindsetCtor)
    if (!mindset) {
      throw new Error(`not found mindset info for ${mindsetCtor.name}`)
    }
    return {
      config: mindset.config,
      modules: mindset.config?.modules?.map((x) => this.getModuleInfo(x)) ?? [],
    }
  }
}
