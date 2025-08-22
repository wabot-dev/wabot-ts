import { Container, injectable } from '@/injection'
import { type IMindset, type IMindsetIdentity, Mindset } from './IMindset'
import {
  IMindsetModuleMetadata,
  type IMindsetFunctionMetadata,
  type IMindsetFunctionParamMetadata,
  type IMindsetMetadata,
} from './metadata/IMindsetMetadata'
import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'
import { IChatTool, IChatToolParameter } from '@/core'

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

  async systemPrompt(): Promise<string> {
    let [identity, skills, limits] = await Promise.all([
      this.identity(),
      this.skills(),
      this.limits(),
    ])

    const language = identity.language.replaceAll('#', ' ')
    const name = identity.name.replaceAll('#', ' ')
    const age = identity.age ? identity.age.toString().replaceAll('#', ' ') : null
    const personality = identity.personality ? identity.personality.replaceAll('#', ' ') : null

    skills = skills.replaceAll('#', ' ')
    limits = limits.replaceAll('#', ' ')

    const systemPrompt = `
         # System Instructions
         you should act as a assistant.
         your main language is ${language}.
         your name is ${name}.
         ${age ? 'you are ' + age + ' years old.' : ''}
         
          ${personality ? '## Personality (in your main language) \n' + personality : ''}
  
          ## Skills (in your main language)
          ${skills}
  
          ## System limitations (in your main language)
          ${limits}
  
          ## Chat memory
          Next you will receive a chat history,
          you should use this information to answer the user.
      `
    return systemPrompt
  }

  tools(): IChatTool[] {
    return this.metadata.modules
      .map((module) => module.functions.map((fn) => this.tool(fn, module)))
      .flat()
  }

  tool(fn: IMindsetFunctionMetadata, module: IMindsetModuleMetadata): IChatTool {
    const description = fn.config.description.replaceAll('#', ' ')
    return {
      language: module.config.language ?? 'english',
      name: fn.name,
      description,
      parameters: fn.params.map((param) => this.toolParameter(param)),
    }
  }

  private toolParameter(param: IMindsetFunctionParamMetadata): IChatToolParameter {
    let description = `
      ### description (in your main language)
      ${param.config.description.replaceAll('#', ' ')}
      `

    const type = (() => {
      if (param.type === Number) return 'number'
      if (param.type === String) return 'string'
      if (param.type === Date) {
        description = `${description}
          ### format: ISO 8681 - YYYY-MM-DDTHH:mm:ssZ
        `
        return 'string'
      }
      throw new Error(`Unsupported type`)
    })()

    return {
      type,
      name: param.name,
      description,
    }
  }

  /**
   * @deprecated use id
   */
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

  /**
   * @deprecated use id
   */
  async allFunctionsDescriptors() {
    return this.metadata.modules
      .map((module) => module.functions.map((fn) => this.functionDescriptor(fn)))
      .flat()
  }

  /**
   * @deprecated use id
   */
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
        required: fn.params.filter((param) => !param.config.optional).map((param) => param.name),
      },
    } as const
  }

  /**
   * @deprecated use id
   */
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
      throw new Error(`Unsupported type`)
    })()

    return {
      type,
      ...addons,
    }
  }
}
