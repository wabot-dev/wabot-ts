import { Container, injectable } from '@/core/injection'
import {
  type IMindset,
  type IMindsetIdentity,
  IMindsetLlm,
  IMindsetModelKind,
  IMindsetModelRef,
  IMindsetModels,
  Mindset,
} from './IMindset'

import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'
import { IMindsetTool } from './IMindsetTool'
import { validateModel } from '@/core/validation'
import { CustomError, errorToPlainObject } from '@/core/error'
import { Logger } from '@/core/logger'
import { DescriptionMetadataStore } from '@/core/description'
import { buildPropertySchema } from './buildParameterSchema'

const MODEL_KIND_FALLBACK: Partial<Record<IMindsetModelKind, IMindsetModelKind>> = {
  visionLlm: 'llm',
  audioLlm: 'llm',
}

@injectable()
export class MindsetOperator implements IMindset {
  private logger = new Logger('wabot:mindset-operator')
  private metadata: ReturnType<MindsetMetadataStore['getMindsetInfo']>

  constructor(
    private mindset: Mindset,
    private container: Container,
    metadataStore: MindsetMetadataStore,
    private descriptionStore: DescriptionMetadataStore,
  ) {
    this.metadata = metadataStore.getMindsetInfo(this.mindset.constructor as any)
  }

  context(): Promise<string> {
    return this.mindset.context()
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

  /** @deprecated use {@link MindsetOperator.models} */
  async llms(): Promise<IMindsetLlm[]> {
    if (this.mindset.llms) return this.mindset.llms()
    const models = await this.models()
    return models.llm ?? []
  }

  async models(): Promise<IMindsetModels> {
    if (this.mindset.models) return this.mindset.models()
    if (this.mindset.llms) return { llm: await this.mindset.llms() }
    throw new Error(
      `Invalid ${this.mindset.constructor.name} - models() or llms() must be implemented`,
    )
  }

  async resolveModels(kind: IMindsetModelKind): Promise<IMindsetModelRef[]> {
    const models = await this.models()
    const direct = models[kind]
    if (direct && direct.length > 0) return direct
    const fallbackKind = MODEL_KIND_FALLBACK[kind]
    if (fallbackKind) {
      const fallback = models[fallbackKind]
      if (fallback && fallback.length > 0) return fallback
    }
    return []
  }

  async systemPrompt(): Promise<string> {
    let [context, identity, skills, limits, workflow] = await Promise.all([
      this.context(),
      this.identity(),
      this.skills(),
      this.limits(),
      this.workflow(),
    ])

    const language = identity.language.replaceAll('#', ' ')
    const name = identity.name.replaceAll('#', ' ')
    const personality = identity.personality ? identity.personality.replaceAll('#', ' ') : null

    context = context.replaceAll('#', ' ')
    skills = skills.replaceAll('#', ' ')
    limits = limits.replaceAll('#', ' ')
    workflow = workflow.replaceAll('#', ' ')

    const systemPrompt = `
      # System Instructions
      you should act as a assistant.
      your main language is ${language}.
      your name is ${name}.

      ${personality ? '## Personality (in your main language) \n' + personality : ''}

      ## Context (in your main language)
      ${context}

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
    const deps = {
      descriptionStore: this.descriptionStore,
    }
    return this.metadata.modules
      .map((module) =>
        module.functions.map((fn) => {
          const argsValidatorsInfo = fn.argsValidatorsInfo
          const propertyValidators = argsValidatorsInfo?.properties ?? {}

          return {
            language: module.config?.language ?? 'english',
            name: fn.name,
            description: fn.description,
            parameters: fn.argsDescriptions.map((arg) => {
              const propInfo = propertyValidators[arg.propertyName]
              const schema = buildPropertySchema(
                propInfo?.validators ?? [],
                this.paramDescription(arg.description, arg.typeDescriptor),
                deps,
              )
              return {
                name: arg.propertyName,
                required: !propInfo?.isOptional,
                schema,
              }
            }),
          }
        }),
      )
      .flat()
  }

  protected paramDescription(rawDescription: string, rawType: string) {
    let description = rawDescription.replaceAll('#', ' ').trim()
    if (rawType === 'date') {
      description = `${description}\nFormat: ISO 8601 - YYYY-MM-DDTHH:mm:ssZ`
    }
    return description
  }

  async callFunction(name: string, params: string): Promise<string> {
    const fnMetadata = this.metadata.modules
      .map((module) => module.functions)
      .flat()
      .find((fn) => fn.name === name)

    if (!fnMetadata) {
      throw new CustomError({
        httpCode: 400,
        code: 'FUNCTION_NOT_WHITELISTED',
        message: `Function '${name}' is not registered in mindset tools`,
      })
    }

    let paramsObj: any
    try {
      paramsObj = JSON.parse(params)
    } catch (parseError) {
      const aiResponse = JSON.stringify({
        error: 'INVALID_JSON_ARGUMENTS',
        message:
          'The function call arguments are not valid JSON. Re-issue the call with a valid JSON object.',
        details: parseError instanceof Error ? parseError.message : String(parseError),
      })
      this.logger.error(`Function '${name}' received non-JSON arguments`, { params, parseError })
      return aiResponse
    }

    const modelValidationInfo = fnMetadata.argsValidatorsInfo
    if (modelValidationInfo) {
      const validation = validateModel(paramsObj, modelValidationInfo)
      if (validation.error) {
        const aiResponse = JSON.stringify({
          error: 'INVALID_ARGUMENTS',
          message:
            'The provided arguments did not pass validation. Inspect the errors below and re-issue the call with corrected arguments.',
          details: this.flattenValidationError(validation.error),
        })
        this.logger.warn(`Function '${name}' received invalid arguments`, {
          params,
          errors: validation.error,
        })
        return aiResponse
      }
      paramsObj = validation.value
    }

    try {
      const module = this.container.resolve<any>(fnMetadata.moduleConstructor as any)

      const response = await module[name](paramsObj)
      if (!response) {
        return 'success'
      }
      return await this.functionResponseToString(response)
    } catch (error) {
      const aiResponse = await this.functionErrorToString(error)
      if (error instanceof Error) {
        this.logger.error(`Function '${name}' threw an exception`, error, { aiResponse })
      } else {
        this.logger.error(`Function '${name}' threw a non-Error value`, { error, aiResponse })
      }
      return aiResponse
    }
  }

  private flattenValidationError(error: any, path = ''): { path: string; message: string }[] {
    const out: { path: string; message: string }[] = []
    if (!error) return out
    if (Array.isArray(error?.items)) {
      error.items.forEach((itemErrors: any, idx: number) => {
        if (!itemErrors) return
        const itemPath = `${path}[${idx}]`
        if (Array.isArray(itemErrors)) {
          itemErrors.forEach((ie) => out.push(...this.flattenValidationError(ie, itemPath)))
        } else {
          out.push(...this.flattenValidationError(itemErrors, itemPath))
        }
      })
      if (out.length > 0) return out
    }
    if (error?.properties && typeof error.properties === 'object') {
      for (const propName in error.properties) {
        const propErrors = error.properties[propName]
        const propPath = path ? `${path}.${propName}` : propName
        if (Array.isArray(propErrors)) {
          propErrors.forEach((pe: any) => out.push(...this.flattenValidationError(pe, propPath)))
        }
      }
      if (out.length > 0) return out
    }
    if (typeof error.description === 'string') {
      out.push({ path: path || '(root)', message: error.description })
    }
    return out
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

    if (error instanceof Error) {
      const { stack: _stack, ...plain } = errorToPlainObject(error)
      return JSON.stringify(plain)
    }

    if (error?.message) {
      return error.message
    }

    return 'Unknown error occurred'
  }
}
