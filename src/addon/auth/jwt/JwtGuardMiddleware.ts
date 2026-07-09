import { CustomError } from '@/core/error'
import { DependencyContainer, injectable } from '@/core/injection'
import { Cookies, IMiddleware } from '@/feature/rest-controller'
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { Auth } from '@/core/auth'
import { JwtConfig } from './JwtConfig'

@injectable()
export class JwtGuardMiddleware implements IMiddleware {
  constructor(
    private config: JwtConfig,
    private auth: Auth<any>,
  ) {}

  async handle(req: Request, res: Response, container: DependencyContainer) {
    const token = this.tokenFromHeader(req) ?? container.resolve(Cookies).get(this.config.cookieName)
    if (!token) {
      throw new CustomError({ httpCode: 401, message: 'Missing authentication token' })
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

  /** `Authorization: Bearer <token>`. Throws only if the header is present but malformed. */
  private tokenFromHeader(req: Request): string | undefined {
    const authorization = req.header('Authorization')
    if (!authorization) {
      return undefined
    }
    const parts = authorization.split(' ')
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new CustomError({
        httpCode: 401,
        message: 'Authorization header must be: Bearer <token>',
      })
    }
    return parts[1]
  }
}
