import { IConstructor } from '@/core/generics'
import { IHandshakeMiddleware } from '@/feature/socket-controller'

export interface ISocketChannelConfig {
  namespace: string
  handshakeMidlewares?: IConstructor<IHandshakeMiddleware>[]
}
