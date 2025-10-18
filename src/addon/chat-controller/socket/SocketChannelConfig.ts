import { injectable } from '@/core/injection'
import type { ISocketChannelConfig } from './ISocketChannelConfig'
import { IConstructor } from '@/core/generics'
import { IHandshakeMiddleware } from '@/feature/socket-controller'

@injectable()
export class SocketChannelConfig implements ISocketChannelConfig {
  constructor(
    public namespace: string,
    public handshakeMidlewares?: IConstructor<IHandshakeMiddleware>[],
  ) {}
}
