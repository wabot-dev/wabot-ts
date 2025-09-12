import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { IConnectionMiddleware } from '@/feature/socket-controller'
import { DependencyContainer, injectable } from '@/core/injection'
import { Auth } from '@/core/auth'
import { CustomError } from '@/core/error'
import { JwtConfig } from './JwtConfig'

@injectable()
export class JwtConnectionGuardMiddleware implements IConnectionMiddleware {
  constructor(
    private config: JwtConfig,
    private auth: Auth<any>,
  ) {}

  async handle(socket: Socket, container: DependencyContainer) {
    if (!socket.handshake.auth.token) {
      let authorization =
        socket.handshake.headers['Authorization'] ?? socket.handshake.headers['authorization']

      if (Array.isArray(authorization)) {
        authorization = authorization[0]
      }
      if (authorization) {
        const [bearer, token] = authorization.split(' ')
        if (bearer.toLowerCase() !== 'bearer' || !token) {
          throw new CustomError({
            httpCode: 401,
            message: 'Authorization should be a bearer token',
          })
        }
        socket.handshake.auth.token = token
      }
    }

    let token = socket.handshake.auth.token

    if (!token) {
      throw new CustomError({ httpCode: 401, message: 'Token not available' })
    }

    try {
      const jwtPayload = jwt.verify(token, this.config.secretOrPublicKey, {
        algorithms: [this.config.algorithm],
      })
      this.auth.assign(jwtPayload)
    } catch (err) {
      throw new CustomError({
        httpCode: 401,
        message: err instanceof Error ? `Invalid token: ${err.message}` : 'Invalid token',
        cause: err instanceof Error ? err : undefined,
      })
    }
  }
}
