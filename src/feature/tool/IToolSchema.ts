export interface IToolParameterSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: (string | number | boolean | null)[]
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  items?: IToolParameterSchema
  properties?: Record<string, IToolParameterSchema>
  required?: string[]
  additionalProperties?: boolean | IToolParameterSchema
}

export interface IToolParameter {
  name: string
  required: boolean
  schema: IToolParameterSchema
}

/**
 * Provider-neutral tool description shipped to the LLM. Shared by mindsets
 * (end-user chatbots) and agents (dev-facing). `IMindsetTool` is a
 * backwards-compatible alias of this type.
 */
export interface IToolSchema {
  language: string
  name: string
  description: string
  parameters: IToolParameter[]
}
