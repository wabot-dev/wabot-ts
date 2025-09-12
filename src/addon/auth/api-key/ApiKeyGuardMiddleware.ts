import { DependencyContainer, injectable } from '@/core/injection'
import { IMiddleware } from '@/feature/rest-controller'

import { Auth } from '@/core/auth'
import { Request, Response } from 'express'
import { CustomError } from '@/core/error'
import { ApiKeyRepository } from './ApiKeyRepository'
import { ApiKey } from './ApiKey'

@injectable()
export class ApiKeyGuardMiddleware implements IMiddleware {
  constructor(
    private apiKeyRepository: ApiKeyRepository,
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
      const keyData = ApiKey.inflate(keySecret)
      const apiKey = await this.apiKeyRepository.findOrThrow(keyData.id)
      apiKey.validatePassword(keyData.pass)
      this.auth.assign(apiKey.authInfo)
    } catch (err) {
      throw new CustomError({
        httpCode: 401,
        message: err instanceof Error ? `Invalid token: ${err.message}` : 'Invalid token',
        cause: err instanceof Error ? err : undefined,
      })
    }
  }
}
