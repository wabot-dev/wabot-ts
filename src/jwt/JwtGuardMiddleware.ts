import { Auth } from '@/auth'

import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JwtConfig } from './JwtConfig'
import { IMiddleware } from '@/rest-controller'
import { DependencyContainer, injectable } from '@/injection'
import { CustomError } from '@/error'

@injectable()
export class JwtGuardMiddleware implements IMiddleware {
  constructor(
    private config: JwtConfig,
    private auth: Auth<any>,
  ) {}

  async handle(req: Request, res: Response, container: DependencyContainer) {
    const authorization = req.header('Authorization')
    if (!authorization) {
      throw new CustomError({ httpCode: 401, message: 'Authorization header not available' })
    }

    const [bearer, token] = authorization.split(' ')
    if (bearer.toLowerCase() !== 'bearer' || !token) {
      throw new CustomError({ httpCode: 401, message: 'Authorization should be a bearer token' })
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
