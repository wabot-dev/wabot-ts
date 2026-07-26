import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Algorithm } from 'jsonwebtoken'

@singleton()
export class JwtConfig {
  secretOrPublicKey: string
  secretOrPrivateKey: string
  algorithm: Algorithm
  accessExpirationSeconds: number
  refreshExpirationSeconds: number

  /**
   * Default cookie name `@jwtGuard` reads the token from (fallback to the
   * Authorization header). Guards that name their own cookie —
   * `@jwtGuard({ cookie })`, for sessions of different user types living in
   * the same browser — ignore this one.
   */
  cookieName: string

  /**
   * Origins allowed to authenticate a **socket handshake** with a cookie
   * (`JWT_COOKIE_ALLOWED_ORIGINS`, comma-separated). A browser attaches
   * cookies to a WebSocket handshake started by any page and enforces no CORS
   * on it, so cookie auth on sockets is only safe against cross-site hijacking
   * if the `Origin` is checked. Empty means no origin is allowed, and
   * `@jwtHandshakeGuard({ cookie })` refuses to read cookies at all.
   */
  cookieAllowedOrigins: string[]

  constructor(env: Env) {
    this.algorithm = env.requireString('JWT_ALGORITHM', { default: 'HS256' }) as Algorithm
    this.secretOrPublicKey = env.requireString('JWT_SECRET')
    this.secretOrPrivateKey = env.requireString('JWT_SECRET')
    this.accessExpirationSeconds = env.requireNumber('JWT_ACCESS_EXPIRATION_SECONDS', {
      default: 10 * 60,
    })
    this.refreshExpirationSeconds = env.requireNumber('JWT_REFRESH_EXPIRATION_SECONDS', {
      default: 365 * 24 * 3600,
    })
    this.cookieName = env.requireString('JWT_COOKIE_NAME', { default: 'wabot_jwt' })
    this.cookieAllowedOrigins = env
      .requireString('JWT_COOKIE_ALLOWED_ORIGINS', { default: '' })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  }
}
