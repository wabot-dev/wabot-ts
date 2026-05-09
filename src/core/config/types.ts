export type ConfigReferenceType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'string-array'
  | 'number-array'
  | 'boolean-array'

export interface ConfigReference {
  type: ConfigReferenceType
  path: string
  default?: string
  __isConfigReference: true
}
