import { IConstructor } from '@/core/generics'
import { IHandshakeMiddleware } from '@/feature/socket-controller'
import type { ConfigReference } from '@/core/config'

export interface ISocketChannelConfig {
  namespace: string | ConfigReference<string>
  handshakeMidlewares?: IConstructor<IHandshakeMiddleware>[]
}
