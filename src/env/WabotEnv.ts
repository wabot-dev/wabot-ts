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
}
