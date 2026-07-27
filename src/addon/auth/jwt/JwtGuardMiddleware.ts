import { CustomError } from '@/core/error'
import { DependencyContainer, injectable } from '@/core/injection'
import { Cookies, IMiddleware } from '@/feature/rest-controller'
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { Auth } from '@/core/auth'
import { AuditActorResolver, setAuditActor } from '@/core/audit'
import { JwtConfig } from './JwtConfig'

export interface IJwtGuardOptions {
  /**
   * Cookie name(s) the token is read from, in order (first one present wins).
   * Defaults to `JwtConfig.cookieName` (`JWT_COOKIE_NAME`).
   *
   * Give each kind of user its own cookie so their sessions coexist in the
   * same browser without overwriting each other, and pass an array for
   * endpoints shared by several of them.
   */
  cookie?: string | string[]

  /**
   * Require this `aud` claim on the token — the audience the token was signed
   * for (`Jwt.createToken({ audience })`). Separate cookies keep sessions from
   * overwriting each other; the audience is what makes a token minted for one
   * kind of user useless on another's endpoints, since both are signed with
   * the same secret. A guard without `audience` accepts any valid token,
   * whatever its `aud`.
   */
  audience?: string
}

/** Cookie names to try, in order, for the given options. */
export function jwtGuardCookieNames(options: IJwtGuardOptions, config: JwtConfig): string[] {
  if (options.cookie == null) {
    return [config.cookieName]
  }
  const names = Array.isArray(options.cookie) ? options.cookie : [options.cookie]
  return names.length ? names : [config.cookieName]
}

@injectable()
export class JwtGuardMiddleware implements IMiddleware {
  constructor(
    private config: JwtConfig,
    private auth: Auth<any>,
  ) {}

  async handle(req: Request, res: Response, container: DependencyContainer) {
    await this.authenticate(req, container)
  }

  /** Guard body. `@jwtGuard(options)` calls this with the endpoint's options. */
  async authenticate(req: Request, container: DependencyContainer, options: IJwtGuardOptions = {}) {
    const names = jwtGuardCookieNames(options, this.config)
    const token = this.tokenFromHeader(req) ?? this.tokenFromCookies(container, names)
    if (!token) {
      throw new CustomError({ httpCode: 401, message: 'Missing authentication token' })
    }

    try {
      const jwtPayload = jwt.verify(token, this.config.secretOrPublicKey, {
        algorithms: [this.config.algorithm],
        ...(options.audience ? { audience: options.audience } : {}),
      })
      this.auth.assign(jwtPayload)
      setAuditActor(container.resolve(AuditActorResolver).fromAuth(jwtPayload))
    } catch (err) {
      throw new CustomError({
        httpCode: 401,
        message: err instanceof Error ? `Invalid token: ${err.message}` : 'Invalid token',
        cause: err instanceof Error ? err : undefined,
      })
    }
  }

  /** First of `names` present in the request cookies. */
  private tokenFromCookies(container: DependencyContainer, names: string[]): string | undefined {
    const cookies = container.resolve(Cookies)
    for (const name of names) {
      const token = cookies.get(name)
      if (token) {
        return token
      }
    }
    return undefined
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
