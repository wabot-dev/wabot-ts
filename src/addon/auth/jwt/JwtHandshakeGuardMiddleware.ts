import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { IHandshakeMiddleware } from '@/feature/socket-controller'
import { DependencyContainer, injectable } from '@/core/injection'
import { Auth } from '@/core/auth'
import { CustomError } from '@/core/error'
import { parseCookieHeader } from '@/feature/rest-controller'
import { JwtConfig } from './JwtConfig'

export interface IJwtHandshakeGuardOptions {
  /**
   * Require this `aud` claim on the token (see `IJwtGuardOptions.audience`).
   * A guard without `audience` accepts any valid token.
   */
  audience?: string

  /**
   * Cookie name(s) to fall back to when the client sends no token in
   * `handshake.auth` nor in the `Authorization` header — the only way to
   * authenticate a socket with an `httpOnly` cookie the browser's JS cannot
   * read.
   *
   * Reading it requires an origin allowlist (`allowedOrigins` or
   * `JWT_COOKIE_ALLOWED_ORIGINS`): the browser attaches cookies to a WebSocket
   * handshake opened by *any* page and enforces no CORS on it, so without the
   * check any site could ride the user's session (cross-site WebSocket
   * hijacking). Tokens taken from `handshake.auth` are not exposed to this and
   * are never origin-checked.
   */
  cookie?: string | string[]

  /**
   * Origins allowed to authenticate with a cookie, overriding
   * `JwtConfig.cookieAllowedOrigins`. Exact `scheme://host[:port]` matches;
   * `*` is rejected, since it would defeat the check.
   */
  allowedOrigins?: string[]
}

/** Normalized for comparison: origins are case-insensitive and never end in `/`. */
function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/$/, '')
}

@injectable()
export class JwtHandshakeGuardMiddleware implements IHandshakeMiddleware {
  constructor(
    private config: JwtConfig,
    private auth: Auth<any>,
  ) {}

  async handle(socket: Socket, container: DependencyContainer) {
    await this.authenticate(socket, container)
  }

  /** Guard body. `@jwtHandshakeGuard(options)` calls this with its options. */
  async authenticate(
    socket: Socket,
    container: DependencyContainer,
    options: IJwtHandshakeGuardOptions = {},
  ) {
    if (!socket.handshake.auth.token) {
      let authorization =
        socket.handshake.headers['Authorization'] ?? socket.handshake.headers['authorization']

      if (Array.isArray(authorization)) {
        authorization = authorization[0]
      }
      if (authorization) {
        const [prefix, token] = authorization.split(' ')
        if (prefix.toLowerCase() !== 'bearer' || !token) {
          throw new CustomError({
            httpCode: 401,
            message: 'Authorization should be a bearer token',
          })
        }
        socket.handshake.auth.token = token
      }
    }

    const token = socket.handshake.auth.token ?? this.tokenFromCookies(socket, options)

    if (!token) {
      throw new CustomError({ httpCode: 401, message: 'Token not available' })
    }

    try {
      const jwtPayload = jwt.verify(token, this.config.secretOrPublicKey, {
        algorithms: [this.config.algorithm],
        ...(options.audience ? { audience: options.audience } : {}),
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

  /**
   * First configured cookie present in the handshake, once the `Origin` has
   * been vetted. Returns `undefined` when the guard declares no cookie.
   */
  private tokenFromCookies(socket: Socket, options: IJwtHandshakeGuardOptions): string | undefined {
    if (options.cookie == null) {
      return undefined
    }
    const names = Array.isArray(options.cookie) ? options.cookie : [options.cookie]
    if (!names.length) {
      return undefined
    }

    this.requireAllowedOrigin(socket, options)

    const cookies = parseCookieHeader(socket.handshake.headers.cookie)
    for (const name of names) {
      if (cookies[name]) {
        return cookies[name]
      }
    }
    return undefined
  }

  /** Fails closed: no allowlist, no `Origin`, or an unlisted one all reject. */
  private requireAllowedOrigin(socket: Socket, options: IJwtHandshakeGuardOptions) {
    const configured = options.allowedOrigins ?? this.config.cookieAllowedOrigins
    const allowed = configured.map(normalizeOrigin).filter(Boolean)

    if (allowed.includes('*')) {
      throw new CustomError({
        httpCode: 401,
        message:
          'Cookie handshake auth cannot allow every origin: list them in JWT_COOKIE_ALLOWED_ORIGINS',
      })
    }
    if (!allowed.length) {
      throw new CustomError({
        httpCode: 401,
        message:
          'Cookie handshake auth requires an origin allowlist (JWT_COOKIE_ALLOWED_ORIGINS or allowedOrigins)',
      })
    }

    const origin = socket.handshake.headers.origin
    if (!origin || !allowed.includes(normalizeOrigin(origin))) {
      throw new CustomError({ httpCode: 401, message: 'Origin not allowed' })
    }
  }
}
