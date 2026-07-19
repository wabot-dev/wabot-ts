import { ConfigError } from './ConfigError'
import { ConfigReference, ConfigReferenceType } from './types'

type ResolveConfigValue<V> = V extends ConfigReference<infer R> ? R : V

export type ResolvedConfig<T> = {
  [K in keyof T]: ResolveConfigValue<T[K]>
}

export function resolveConfigReferences<T extends Record<string, any>>(
  config: T,
): ResolvedConfig<T> {
  const resolved: Record<string, any> = {}

  for (const [key, value] of Object.entries(config)) {
    if (isConfigReference(value)) {
      resolved[key] = ConfigResolver.resolve(value)
    } else {
      resolved[key] = value
    }
  }

  return resolved as ResolvedConfig<T>
}

function isConfigReference(value: unknown): value is ConfigReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isConfigReference' in value &&
    (value as ConfigReference).__isConfigReference === true
  )
}

export class ConfigResolver {
  static resolve(reference: ConfigReference): unknown {
    const envVar = this.pathToEnvVar(reference.path)
    const raw = this.loadFromEnv(reference.path) ?? reference.default

    if (raw === undefined) {
      throw new ConfigError(
        `Config not found: ${reference.path} (env: ${envVar})`,
        reference.path,
        envVar,
      )
    }

    try {
      return coerceConfigValue(raw, reference.type)
    } catch (err) {
      if (err instanceof ConfigError) throw err
      throw new ConfigError((err as Error).message, reference.path, envVar)
    }
  }

  private static loadFromEnv(path: string): string | undefined {
    const envVar = this.pathToEnvVar(path)
    const value = process.env[envVar]
    return value === '' ? undefined : value
  }

  private static pathToEnvVar(path: string): string {
    return path.toUpperCase().replace(/\./g, '_')
  }
}

/**
 * Coerce a raw string to a config type. This is the single coercion engine —
 * used by {@link ConfigResolver} (declarative config references) and by the
 * imperative {@link Env} reader — so there is one place that turns env strings
 * into typed values.
 */
export function coerceConfigValue(value: string, type: ConfigReferenceType): unknown {
  switch (type) {
    case 'string':
      return value

    case 'number': {
      const num = Number(value)
      if (isNaN(num)) {
        throw new Error(`Cannot coerce "${value}" to number`)
      }
      return num
    }

    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1' || value === 'yes'

    case 'object':
      try {
        return JSON.parse(value)
      } catch {
        throw new Error(`Cannot coerce "${value}" to object (invalid JSON)`)
      }

    case 'string-array':
    case 'number-array':
    case 'boolean-array': {
      const items = parseArrayItems(value)
      const itemType =
        type === 'string-array' ? 'string' : type === 'number-array' ? 'number' : 'boolean'
      return items.map((item) => coerceConfigValue(item, itemType))
    }
  }
}

function parseArrayItems(value: string): string[] {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error(`Cannot coerce "${value}" to array (invalid JSON)`)
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array but got ${typeof parsed}: "${value}"`)
    }
    return parsed.map((item) => String(item))
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
