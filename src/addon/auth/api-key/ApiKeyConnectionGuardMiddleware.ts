import { Auth } from '@/core/auth'
import { CustomError } from '@/core/error'
import { DependencyContainer, injectable } from '@/core/injection'
import { IConnectionMiddleware } from '@/feature/socket-controller'
import { Socket } from 'socket.io'
import { ApiKeyRepository } from './ApiKeyRepository'

@injectable()
export class ApiKeyConnectionGuardMiddleware implements IConnectionMiddleware {
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
        const [prefix, token] = authorization.split(' ')
        if (prefix.toLowerCase() !== 'api-key' || !token) {
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
