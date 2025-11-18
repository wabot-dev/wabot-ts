import { Container, injectable } from '@/core/injection'
import { type IMindset, type IMindsetIdentity, IMindsetLlm, Mindset } from './IMindset'

import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'
import { IMindsetMetadata } from './metadata'
import { description } from '@/core/description'


@injectable()
export class MindsetOperator implements IMindset {
  private metadata: ReturnType<MindsetMetadataStore['getMindsetInfo']>

  constructor(
    private mindset: Mindset,
    private container: Container,
    private metadataStore: MindsetMetadataStore,
  ) {
    this.metadata = metadataStore.getMindsetInfo(this.mindset.constructor as any)
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

  workflow(): Promise<string> {
    return this.mindset.workflow()
  }

  llms(): Promise<IMindsetLlm[]> {
    return this.mindset.llms()
  }

  async systemPrompt(): Promise<string> {
    let [identity, skills, limits, workflow] = await Promise.all([
      this.identity(),
      this.skills(),
      this.limits(),
      this.workflow(),
    ])

    const language = identity.language.replaceAll('#', ' ')
    const name = identity.name.replaceAll('#', ' ')
    const age = identity.age ? identity.age.toString().replaceAll('#', ' ') : null
    const personality = identity.personality ? identity.personality.replaceAll('#', ' ') : null

    skills = skills.replaceAll('#', ' ')
    limits = limits.replaceAll('#', ' ')
    workflow = workflow.replaceAll('#', ' ')

    const systemPrompt = `
         # System Instructions
         you should act as a assistant.
         your main language is ${language}.
         your name is ${name}.
         ${age ? 'you are ' + age + ' years old.' : ''}
         
          ${personality ? '## Personality (in your main language) \n' + personality : ''}
  
          ## Skills (in your main language)
          ${skills}

          ## Workflow (in your main language)
          ${workflow}
  
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
      .map((module) => module.functions.map((fn) => {
        return {
          name: fn.name,
          description: fn.description,
          language: module.config?.language ?? 'english',
          parameters: fn.functionArgValidationInfo?.properties.
        }

      }))
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
      return await this.functionResponseToString(response)
    } catch (error) {
      return await this.functionErrorToString(error)
    }
  }

  async functionResponseToString(response: any): Promise<string> {
    if (response instanceof Response) {
      const contentType = response.headers.get('Content-Type') || ''
      let body: any

      try {
        body = contentType.includes('application/json')
          ? await response.json()
          : await response.text()
      } catch (error) {
        body = { message: response.ok ? 'OK' : 'Unable to parse error body' }
      }

      return JSON.stringify({
        httpCode: response.status,
        body: typeof body === 'object' ? body : { message: body },
      })
    }

    const type = typeof response
    if (type === 'string') {
      return response
    } else if (type === 'boolean' || type === 'number') {
      return `${response}`
    } else {
      return JSON.stringify(response)
    }
  }

  async functionErrorToString(error: any): Promise<string> {
    if (error instanceof Response) {
      return await this.functionResponseToString(error)
    }

    if (error?.response && typeof error.response === 'object' && error.response.status) {
      const { status, data } = error.response

      return JSON.stringify({
        httpCode: status,
        body: typeof data === 'object' ? data : { message: data?.toString?.() || 'Unknown error' },
      })
    }

    if (error?.message) {
      return error.message
    }

    return 'Unknown error occurred'
  }
}
