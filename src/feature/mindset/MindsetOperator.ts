import { Container, injectable } from '@/core/injection'
import { type IMindset, type IMindsetIdentity, IMindsetLlm, Mindset } from './IMindset'
import {
  IMindsetModuleMetadata,
  type IMindsetFunctionMetadata,
  type IMindsetFunctionParamMetadata,
  type IMindsetMetadata,
} from './metadata/IMindsetMetadata'
import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'
import { IMindsetTool, IMindsetToolParameter } from './IMindsetTool'

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

  llms(): Promise<IMindsetLlm[]> {
    return this.mindset.llms()
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

  tools(): IMindsetTool[] {
    return this.metadata.modules
      .map((module) => module.functions.map((fn) => this.tool(fn, module)))
      .flat()
  }

  protected tool(fn: IMindsetFunctionMetadata, module: IMindsetModuleMetadata): IMindsetTool {
    const description = fn.config.description.replaceAll('#', ' ')
    return {
      language: module.config.language ?? 'english',
      name: fn.name,
      description,
      parameters: fn.params.map((param) => this.toolParameter(param)),
    }
  }

  protected toolParameter(param: IMindsetFunctionParamMetadata): IMindsetToolParameter {
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
      return this.functionResponseToString(response)
    } catch (error) {
      return `Error: ${error}`
    }
  }

  functionResponseToString(response: any): string {
    const type = typeof response
    if (type === 'string') {
      return response
    } else if (type === 'boolean' || type === 'number') {
      return `${response}`
    } else {
      return JSON.stringify(response)
    }
  }
}
