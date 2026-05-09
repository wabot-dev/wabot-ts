import { ConfigReference } from './types'

export class ConfigResolver {
  static resolve(reference: ConfigReference): unknown {
    const envValue = this.loadFromEnv(reference.path)

    if (envValue === undefined) {
      if (reference.default !== undefined) {
        return this.coerce(reference.default, reference.type)
      }
      throw new Error(
        `Config not found: ${reference.path} (env: ${this.pathToEnvVar(reference.path)})`,
      )
    }

    return this.coerce(envValue, reference.type)
  }

  private static loadFromEnv(path: string): string | undefined {
    const envVar = this.pathToEnvVar(path)
    const value = process.env[envVar]
    return value === '' ? undefined : value
  }

  private static pathToEnvVar(path: string): string {
    return path.toUpperCase().replace(/\./g, '_')
  }

  private static coerce(value: string, type: ConfigReference['type']): unknown {
    switch (type) {
      case 'string':
        return value

      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          throw new Error(`Cannot coerce "${value}" to number`)
        }
        return num

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
        const items = this.parseArrayItems(value)
        const itemType =
          type === 'string-array' ? 'string' : type === 'number-array' ? 'number' : 'boolean'
        return items.map((item) => this.coerce(item, itemType))
      }
    }
  }

  private static parseArrayItems(value: string): string[] {
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
}
