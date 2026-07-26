import { DependencyContainer, injectable } from '@/core/injection'
import { handshakeMiddlewares, IHandshakeMiddleware } from '@/feature/socket-controller'
import { Socket } from 'socket.io'
import { IConstructor } from '@/core/generics'
import {
  IJwtHandshakeGuardOptions,
  JwtHandshakeGuardMiddleware,
} from './JwtHandshakeGuardMiddleware'

/**
 * Protect a socket controller's handshake with a JWT, read from
 * `handshake.auth.token` or the `Authorization` header.
 *
 * ```typescript
 * @socketController({ namespace: 'admin' })
 * @jwtHandshakeGuard({ audience: 'admin' })
 * export class AdminSocketController { ... }
 * ```
 *
 * Pass `cookie` to also accept an `httpOnly` session cookie — it needs an
 * origin allowlist, see {@link IJwtHandshakeGuardOptions.cookie}.
 */
export function jwtHandshakeGuard(options: IJwtHandshakeGuardOptions = {}) {
  if (options.audience == null && options.cookie == null) {
    return function (target: IConstructor<any>) {
      handshakeMiddlewares([JwtHandshakeGuardMiddleware])(target)
    }
  }

  @injectable()
  class ScopedJwtHandshakeGuardMiddleware implements IHandshakeMiddleware {
    async handle(socket: Socket, container: DependencyContainer) {
      await container.resolve(JwtHandshakeGuardMiddleware).authenticate(socket, container, options)
    }
  }

  return function (target: IConstructor<any>) {
    handshakeMiddlewares([ScopedJwtHandshakeGuardMiddleware])(target)
  }
}
