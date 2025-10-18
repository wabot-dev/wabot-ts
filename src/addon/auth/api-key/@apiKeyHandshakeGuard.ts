import { handshakeMiddlewares } from '@/feature/socket-controller'
import { ApiKeyHandshakeGuardMiddleware } from './ApiKeyHandshakeGuardMiddleware'
import { IConstructor } from '@/core/generics'

export function apiKeyHandshakeGuard() {
  return function (target: IConstructor<any>) {
    handshakeMiddlewares([ApiKeyHandshakeGuardMiddleware])(target)
  }
}
