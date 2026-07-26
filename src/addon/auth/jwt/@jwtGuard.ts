import { DependencyContainer, injectable } from '@/core/injection'
import { IMiddleware, middleware } from '@/feature/rest-controller'
import { Request, Response } from 'express'
import { IJwtGuardOptions, JwtGuardMiddleware } from './JwtGuardMiddleware'

/**
 * Protect a REST endpoint with a JWT. The token is taken from the
 * `Authorization: Bearer` header or, failing that, from the auth cookie.
 *
 * ```typescript
 * @onGet('/orders')
 * @jwtGuard({ cookie: 'wabot_admin', audience: 'admin' })
 * async list() { ... }
 *
 * @onPost('/logout')
 * @jwtGuard({ cookie: ['wabot_admin', 'wabot_client'] })   // either session
 * async logout() { ... }
 * ```
 */
export function jwtGuard(options: IJwtGuardOptions = {}) {
  if (options.cookie == null && options.audience == null) {
    return function (target: object, propertyKey: string | symbol) {
      middleware(JwtGuardMiddleware)(target, propertyKey)
    }
  }

  @injectable()
  class ScopedJwtGuardMiddleware implements IMiddleware {
    async handle(req: Request, res: Response, container: DependencyContainer) {
      await container.resolve(JwtGuardMiddleware).authenticate(req, container, options)
    }
  }

  return function (target: object, propertyKey: string | symbol) {
    middleware(ScopedJwtGuardMiddleware)(target, propertyKey)
  }
}
