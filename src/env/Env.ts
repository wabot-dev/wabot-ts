import { singleton } from 'tsyringe'

export type IEnvType = 'development' | 'staging' | 'testing' | 'production'

@singleton()
export class Env {
  private envType: IEnvType

  constructor() {
    this.envType = (process.env.WABOT_ENV as any) ?? 'development'
  }

  isDevelopment() {
    return this.envType === 'development'
  }

  isProduction() {
    return this.envType === 'production'
  }

  isTesting() {
    return this.envType === 'testing'
  }

  requireString(varName: string, options?: { default?: string }): string {
    const value = process.env[varName] ?? options?.default
    if (!value) throw new Error(`Env Variable ${varName} is required`)
    return value
  }

  requireNumber(varName: string, options?: { default?: number }): number {
    const strValue = this.requireString(varName, {
      default: options?.default != null ? String(options.default) : undefined,
    })
    const value = Number(strValue)
    if (isNaN(value)) throw new Error(`Env Variable ${varName} should have number format`)
    return value
  }
}
