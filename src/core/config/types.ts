export interface ConfigReference {
  type: 'string' | 'number' | 'boolean' | 'object'
  path: string
  default?: string
  __isConfigReference: true
}
