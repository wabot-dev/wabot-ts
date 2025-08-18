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

  requireString(varName: string): string {
    const value = process.env[varName]
    if (!value) throw new Error(`Env Variable ${varName} is required`)
    return value
  }

  requireNumber(varName: string): number {
    const strValue = process.env[varName]
    if (!strValue) throw new Error(`Env Variable ${varName} is required`)
    const value = Number(strValue)
    if (isNaN(value)) throw new Error(`Env Variable ${varName} should have number format`)
    return value
  }
}
