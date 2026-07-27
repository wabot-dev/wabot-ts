import { inject, injectable } from '@/core/injection'
import type { Request, Response } from 'express'
import { EXPRESS_REQ, EXPRESS_RES } from './injection-tokens'

export interface ICookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none' | boolean
  /** Absolute expiry. */
  expires?: Date
  /** Relative expiry in milliseconds. */
  maxAge?: number
  path?: string
  domain?: string
}

/**
 * Parse a raw `Cookie` header into a name→value map. Exported because cookies
 * also arrive outside the Express request scope — a Socket.IO handshake, for
 * instance, carries them in `handshake.headers.cookie`.
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index === -1) continue
    const name = pair.slice(0, index).trim()
    if (name) out[name] = decodeURIComponent(pair.slice(index + 1).trim())
  }
  return out
}

/**
 * Request-scoped helper to read and write cookies — agnostic of what they hold.
 * Inject it in any REST or UI handler/middleware. `@jwtGuard` uses it to read
 * the auth cookie, but you can use it for anything (sessions, prefs, flags).
 */
@injectable()
export class Cookies {
  constructor(
    @inject(EXPRESS_REQ) private req: Request,
    @inject(EXPRESS_RES) private res: Response,
  ) {}

  /** Read one cookie, or `undefined` if absent. */
  get(name: string): string | undefined {
    return this.getAll()[name]
  }

  /** All cookies as a name→value map. */
  getAll(): Record<string, string> {
    return parseCookieHeader(this.req.headers.cookie)
  }

  /** Write a cookie on the response. Defaults to `path: '/'`. */
  set(name: string, value: string, options: ICookieOptions = {}): void {
    this.res.cookie(name, value, { path: '/', ...options })
  }

  /** Remove a cookie (expires it). Use the same `path`/`domain` it was set with. */
  clear(name: string, options: ICookieOptions = {}): void {
    this.res.clearCookie(name, { path: '/', ...options })
  }
}
