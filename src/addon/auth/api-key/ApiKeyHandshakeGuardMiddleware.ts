import { Auth } from '@/core/auth'
import { CustomError } from '@/core/error'
import { DependencyContainer, injectable } from '@/core/injection'
import { IHandshakeMiddleware } from '@/feature/socket-controller'
import { Socket } from 'socket.io'
import { ApiKeyRepository } from './ApiKeyRepository'

@injectable()
export class ApiKeyHandshakeGuardMiddleware implements IHandshakeMiddleware {
  constructor(
    private apiKeyRepository: ApiKeyRepository<any>,
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
        const parts = authorization.split(' ')
        if (parts.length !== 2) {
          throw new CustomError({
            httpCode: 401,
            message: 'Authorization header must be: Api-Key <token>',
          })
        }

        const [prefix, token] = parts
        if (prefix.toLowerCase() !== 'api-key') {
          throw new CustomError({
            httpCode: 401,
            message: 'Authorization should be an Api-Key',
          })
        }
        socket.handshake.auth.token = token
      }
    }

    let keySecret = socket.handshake.auth.token

    if (!keySecret) {
      throw new CustomError({ httpCode: 401, message: 'Token not available' })
    }

    try {
      const authInfo = await this.apiKeyRepository.findAndValidate(keySecret)
      this.auth.assign(authInfo)
    } catch (err) {
      throw new CustomError({
        httpCode: 401,
        message: err instanceof Error ? `Invalid token: ${err.message}` : 'Invalid token',
        cause: err instanceof Error ? err : undefined,
      })
    }
  }
}
