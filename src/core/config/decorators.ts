import { ConfigReference } from './types'
import { ConfigResolver } from './resolver'

export function resolveConfigReferences<T extends Record<string, any>>(config: T): T {
  const resolved: Record<string, any> = {}

  for (const [key, value] of Object.entries(config)) {
    if (isConfigReference(value)) {
      resolved[key] = ConfigResolver.resolve(value)
    } else {
      resolved[key] = value
    }
  }

  return resolved as T
}

function isConfigReference(value: unknown): value is ConfigReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isConfigReference' in value &&
    (value as ConfigReference).__isConfigReference === true
  )
}
