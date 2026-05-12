import { injectable } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IHandshakeMiddleware } from '@/feature/socket-controller'

@injectable()
export class SocketChannelConfig {
  public namespace: string
  public handshakeMidlewares?: IConstructor<IHandshakeMiddleware>[]

  constructor(config: {
    namespace: string
    handshakeMidlewares?: IConstructor<IHandshakeMiddleware>[]
  }) {
    this.namespace = config.namespace
    this.handshakeMidlewares = config.handshakeMidlewares
  }
}
