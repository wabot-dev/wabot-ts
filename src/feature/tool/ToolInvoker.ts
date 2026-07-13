import { Container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { CustomError, errorToPlainObject } from '@/core/error'
import { Logger } from '@/core/logger'
import { DescriptionMetadataStore } from '@/core/description'
import { validateModel } from '@/core/validation'
import { IToolSchema } from './IToolSchema'
import { IToolClassInfo, IToolFunctionInfo, ToolMetadataStore } from './ToolMetadataStore'
import { buildPropertySchema } from './buildParameterSchema'

/** A tool selector: either the tool class itself or one of its function names. */
export type IToolRef = IConstructor<any> | string

export interface IToolInvokerOptions {
  /** If set, only these tools (class or function name) are exposed/callable. */
  allow?: IToolRef[]
  /** These tools (class or function name) are never exposed/callable. */
  deny?: IToolRef[]
  /**
   * When true, honor `exposeToMindsets: false` on a tool class: such tools are
   * hidden unless explicitly allow-listed. Used on the mindset→agent delegation
   * path so a mindset can never reach privileged agent tools.
   */
  forMindset?: boolean
}

/**
 * Provider-neutral tool runtime shared by mindsets and agents. Turns a set of
 * `@tools` classes into the LLM tool schema ({@link schema}) and dispatches
 * model function calls back into the DI-resolved instances ({@link call}),
 * with validation and gating.
 */
export class ToolInvoker {
  private logger = new Logger('wabot:tool-invoker')

  private readonly toolClasses: IConstructor<any>[]

  constructor(
    toolClasses: IConstructor<any>[],
    private container: Container,
    private metadataStore: ToolMetadataStore,
    private descriptionStore: DescriptionMetadataStore,
    private options: IToolInvokerOptions = {},
  ) {
    // De-duplicate the class list so a class listed twice doesn't look like a
    // name collision below.
    this.toolClasses = [...new Set(toolClasses)]
  }

  schema(): IToolSchema[] {
    const built = this.toolClasses
      .map((ctor) => this.metadataStore.getToolClassInfo(ctor))
      .flatMap((info) =>
        info.functions
          .filter((fn) => this.isAllowed(info, fn))
          .map((fn) => ({
            owner: (fn.moduleConstructor as { name?: string })?.name ?? 'unknown',
            schema: this.buildFunctionSchema(info, fn),
          })),
      )
    this.assertUniqueNames(built)
    return built.map((b) => b.schema)
  }

  private buildFunctionSchema(info: IToolClassInfo, fn: IToolFunctionInfo): IToolSchema {
    const deps = { descriptionStore: this.descriptionStore }
    const propertyValidators = fn.argsValidatorsInfo?.properties ?? {}
    return {
      language: info.config?.language ?? 'english',
      name: fn.name,
      description: fn.description,
      parameters: fn.argsDescriptions.map((arg) => {
        const propInfo = propertyValidators[arg.propertyName]
        return {
          name: arg.propertyName,
          required: !propInfo?.isOptional,
          schema: buildPropertySchema(
            propInfo?.validators ?? [],
            this.paramDescription(arg.description, arg.typeDescriptor),
            deps,
          ),
        }
      }),
    }
  }

  /**
   * Two exposed tool functions with the same name are ambiguous — the model
   * can't disambiguate them and {@link call} would silently dispatch to the
   * first. Fail fast with a clear message instead.
   */
  private assertUniqueNames(built: { owner: string; schema: IToolSchema }[]): void {
    const ownersByName = new Map<string, string[]>()
    for (const b of built) {
      const owners = ownersByName.get(b.schema.name) ?? []
      owners.push(b.owner)
      ownersByName.set(b.schema.name, owners)
    }
    const conflicts = [...ownersByName.entries()].filter(([, owners]) => owners.length > 1)
    if (conflicts.length > 0) {
      const details = conflicts.map(([name, owners]) => `'${name}' (${owners.join(', ')})`).join('; ')
      throw new CustomError({
        httpCode: 500,
        code: 'DUPLICATE_TOOL_NAME',
        message:
          `Duplicate tool name(s) exposed to the model: ${details}. Tool function ` +
          `names must be unique across the set; rename a method or exclude one with allow/deny.`,
      })
    }
  }

  async call(name: string, params: string): Promise<string> {
    const entry = this.toolClasses
      .map((ctor) => this.metadataStore.getToolClassInfo(ctor))
      .flatMap((info) => info.functions.map((fn) => ({ info, fn })))
      .find((x) => x.fn.name === name)

    if (!entry) {
      throw new CustomError({
        httpCode: 400,
        code: 'FUNCTION_NOT_WHITELISTED',
        message: `Function '${name}' is not registered in mindset tools`,
      })
    }

    if (!this.isAllowed(entry.info, entry.fn)) {
      this.logger.warn(`Function '${name}' is not allowed in this context`)
      return JSON.stringify({
        error: 'TOOL_NOT_ALLOWED',
        message: `Function '${name}' is not available in this context. Do not call it again.`,
      })
    }

    const fnMetadata = entry.fn

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

  private isAllowed(info: IToolClassInfo, fn: IToolFunctionInfo): boolean {
    const ctor = fn.moduleConstructor
    const name = fn.name
    const { allow, deny, forMindset } = this.options

    const matches = (ref: IToolRef) => ref === ctor || ref === name

    if (deny && deny.some(matches)) return false

    const explicitlyAllowed = allow ? allow.some(matches) : false

    if (forMindset && info.config?.exposeToMindsets === false && !explicitlyAllowed) {
      return false
    }

    if (allow && allow.length > 0) {
      return explicitlyAllowed
    }

    return true
  }

  protected paramDescription(rawDescription: string, rawType: string) {
    let description = rawDescription.replaceAll('#', ' ').trim()
    if (rawType === 'date') {
      description = `${description}\nFormat: ISO 8601 - YYYY-MM-DDTHH:mm:ssZ`
    }
    return description
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
