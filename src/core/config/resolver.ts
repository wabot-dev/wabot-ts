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
    }
  }
}
