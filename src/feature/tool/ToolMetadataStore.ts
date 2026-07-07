import { singleton } from '@/core/injection'

import { DescriptionMetadataStore } from '@/core/description'
import { IConstructor } from '@/core/generics'
import { ValidationMetadataStore } from '@/core/validation'
import { IToolMetadata } from './IToolMetadata'

/**
 * Registry of `@tools` classes (also fed by the deprecated `@mindsetModule`).
 * Turns a tool class into the per-function schema/dispatch info that both
 * {@link MindsetOperator} and the agent runtime consume through
 * {@link ToolInvoker}.
 */
@singleton()
export class ToolMetadataStore {
  private readonly toolClasses = new Map<Function, IToolMetadata>()

  constructor(
    private descriptionMetadataStore: DescriptionMetadataStore,
    private validationMetadataStore: ValidationMetadataStore,
  ) {}

  public saveToolMetadata(metadata: IToolMetadata): void {
    this.toolClasses.set(metadata.constructor, metadata)
  }

  public getToolClassInfo(toolCtor: IConstructor<any>) {
    const tool = this.toolClasses.get(toolCtor)
    if (!tool) {
      throw new Error(`not found @tools info for ${toolCtor.name}`)
    }

    const descriptions = this.descriptionMetadataStore.getModelDescriptions(toolCtor)
    const functions = descriptions.filter((x) => x.propertyType === Function)

    return {
      config: tool.config,
      functions: functions.map((x) => {
        if (x.functionArgsTypes && x.functionArgsTypes.length > 1) {
          throw new Error(
            `invalid tool function ${x.propertyName}, should have none or one object parámeter`,
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
          throw new Error(`the model '${toolCtor.name}' have properties without descriptions`)
        }

        return {
          moduleConstructor: toolCtor,
          function: x,
          name: x.propertyName,
          description: x.description,
          argsDescriptions: argsDescriptionsWithTypes,
          argsValidatorsInfo: functionArgsModelValidatorsInfo,
        }
      }),
    }
  }
}

export type IToolClassInfo = ReturnType<ToolMetadataStore['getToolClassInfo']>
export type IToolFunctionInfo = IToolClassInfo['functions'][number]
