import { DependencyContainer, injectable } from '@/core/injection'
import { IMiddleware } from '@/feature/rest-controller'

import { Auth } from '@/core/auth'
import { CustomError } from '@/core/error'
import { Request, Response } from 'express'
import { ApiKeyRepository } from './ApiKeyRepository'

@injectable()
export class ApiKeyGuardMiddleware implements IMiddleware {
  constructor(
    private apiKeyRepository: ApiKeyRepository<any>,
    private auth: Auth<any>,
  ) {}

  async handle(req: Request, res: Response, container: DependencyContainer) {
    const authorization = req.header('Authorization')
    if (!authorization) {
      throw new CustomError({ httpCode: 401, message: 'Authorization header not available' })
    }

    const [keyPrefix, keySecret] = authorization.split(' ')
    if (keyPrefix.toLowerCase() !== 'api-key' || !keySecret) {
      throw new CustomError({ httpCode: 401, message: 'Authorization should be an Api-Key' })
    }

    try {
      const authInfo = await this.apiKeyRepository.findAuthInfoBySecret(keySecret)
      if (!authInfo) {
        throw new CustomError({ httpCode: 401, message: 'Invalid key' })
      }
      this.auth.assign(authInfo)
    } catch (err) {
      throw new CustomError({
        httpCode: 401,
        message: err instanceof Error ? `Invalid key: ${err.message}` : 'Invalid key',
        cause: err instanceof Error ? err : undefined,
      })
    }
  }
}
