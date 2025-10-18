import { handshakeMiddlewares } from '@/feature/socket-controller'
import { JwtHandshakeGuardMiddleware } from './JwtHandshakeGuardMiddleware'
import { IConstructor } from '@/core/generics'

export function jwtHandshakeGuard() {
  return function (target: IConstructor<any>) {
    handshakeMiddlewares([JwtHandshakeGuardMiddleware])(target)
  }
}
