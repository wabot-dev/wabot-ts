export type ConfigReferenceType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'string-array'
  | 'number-array'
  | 'boolean-array'

export interface ConfigReference<TResolved = unknown> {
  type: ConfigReferenceType
  path: string
  default?: string
  __isConfigReference: true
  __resolvedType?: TResolved
}
