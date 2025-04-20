import { Container, injectable } from '@/injection'
import { IMindset, IMindsetIdentity, Mindset } from './IMindset'
import { IMindsetFunctionMetadata, IMindsetFunctionParamMetadata, IMindsetMetadata } from './metadata/IMindsetMetadata'
import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'

@injectable()
export class MindsetOperator implements IMindset {
  private metadata: IMindsetMetadata

  constructor(
    private mindset: Mindset,
    private container: Container,
    metadataStore: MindsetMetadataStore,
  ) {
    this.metadata = metadataStore.getMindsetMetadata(this.mindset.constructor)
  }

  identity(): Promise<IMindsetIdentity> {
    return this.mindset.identity()
  }

  skills(): Promise<string> {
    return this.mindset.skills()
  }

  limits(): Promise<string> {
    return this.mindset.limits()
  }

  async callFunction(name: string, params: string): Promise<string> {
    const fnMetadata = this.metadata.modules
      .map((module) => module.functions)
      .flat()
      .find((fn) => fn.name === name)

    if (!fnMetadata) {
      throw new Error(`Function ${name} not found`)
    }

    const paramsObj = JSON.parse(params)
    const module = this.container.resolve<any>(fnMetadata.moduleConstructor as any)

    try {
      const response = await module[name](paramsObj)
      if (!response) {
        return 'success'
      }
      return response.toString()
    } catch (error) {
      return `Error: ${error}`
    }
  }

  async allFunctionsDescriptors() {
    return this.metadata.modules
      .map((module) => module.functions.map((fn) => this.functionDescriptor(fn)))
      .flat()
  }

  private functionDescriptor(fn: IMindsetFunctionMetadata) {
    const description = fn.config.description.replaceAll('#', ' ')
    return {
      type: 'function',
      name: fn.name,
      description,
      parameters: {
        type: 'object',
        properties: fn.params.reduce(
          (prev, param) => ({
            ...prev,
            [param.name]: this.toolParam(param),
          }),
          {},
        ),
        required: fn.params.map((param) => param.name),
      },
    } as const
  }

  private toolParam(param: IMindsetFunctionParamMetadata) {
    const addons: { [key: string]: string } = {
      description: `
      ### description (in your main language)
      ${param.config.description.replaceAll('#', ' ')}
      `,
    }

    const type = (() => {
      if (param.type === Number) return 'number'
      if (param.type === String) return 'string'
      if (param.type === Date) {
        addons.description = `${addons.description}
          ### format: ISO 8681 - YYYY-MM-DDTHH:mm:ssZ
          ${addons.description}
        `
        return 'string'
      }
      debugger
      throw new Error(`Unsupported type`)
    })()

    return {
      type,
      ...addons,
    }
  }
}
