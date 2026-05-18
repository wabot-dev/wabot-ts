export interface IMindsetParameterSchema {
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
  items?: IMindsetParameterSchema
  properties?: Record<string, IMindsetParameterSchema>
  required?: string[]
  additionalProperties?: boolean | IMindsetParameterSchema
}

export interface IMindsetToolParameter {
  name: string
  required: boolean
  schema: IMindsetParameterSchema
}
