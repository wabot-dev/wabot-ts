import { singleton } from 'tsyringe'

export type IWabotEnvType = 'development' | 'staging' | 'testing' | 'production'

@singleton()
export class WabotEnv {
  private envType: IWabotEnvType

  constructor() {
    this.envType = (process.env.WABOT_ENV as any) ?? 'development'
  }

  isDevelopment() {
    return this.envType === 'development'
  }

  isProduction() {
    return this.envType === 'production'
  }

  requireString(varName: string): string {
    const value = process.env[varName]
    if (!value) throw new Error(`Env Variable ${varName} is required`)
    return value
  }
}
