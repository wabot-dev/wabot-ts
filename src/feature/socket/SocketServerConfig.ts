import { Env } from '@/core/env'
import { singleton } from '@/core/injection'

@singleton()
export class SocketServerConfig {
  corsOrigin: string | string[]

  constructor(env: Env) {
    const origin = env.requireString('SOCKET_CORS_ORIGIN', { default: '' })
    if (!origin) {
      this.corsOrigin = false as unknown as string
    } else if (origin === '*') {
      this.corsOrigin = '*'
    } else {
      this.corsOrigin = origin.split(',').map((o) => o.trim())
    }
  }
}
