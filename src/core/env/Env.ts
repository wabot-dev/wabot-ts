import { coerceConfigValue } from '../config'
import { singleton } from '../injection'

/**
 * Imperative reader for environment variables by their literal name, with
 * optional defaults. Type coercion is delegated to the shared config engine
 * (`coerceConfigValue`), so an imperative `requireNumber('X')` and a declarative
 * `num\`x\`` reference coerce identically. Use this in service/adapter code; use
 * the config tag functions (`str`/`num`/…) for declarative decorator configs.
 */
@singleton()
export class Env {
  requireString(varName: string, options?: { default?: string }): string {
    const value = process.env[varName] ?? options?.default
    if (value == null) throw new Error(`Env Variable ${varName} is required`)
    return value
  }

  requireNumber(varName: string, options?: { default?: number }): number {
    const strValue = this.requireString(varName, {
      default: options?.default != null ? String(options.default) : undefined,
    })
    try {
      return coerceConfigValue(strValue, 'number') as number
    } catch {
      throw new Error(`Env Variable ${varName} should have number format`)
    }
  }
}
