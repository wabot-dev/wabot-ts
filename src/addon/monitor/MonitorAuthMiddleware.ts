import type { DependencyContainer } from '@/core/injection'
import { injectable } from '@/core/injection'
import { CustomError } from '@/core/error'
import { IMiddleware } from '@/feature/rest-controller'
import type { Request, Response } from 'express'

const COOKIE_NAME = 'monitor_key'

/**
 * API-key guard for the monitor. Accepts the key via the `?key=` query param
 * (a browser navigation cannot send an `Authorization` header) and persists it
 * as a cookie so subsequent navigations across the monitor's multiple views
 * stay authenticated without re-appending `?key=`. The expected key is
 * `process.env.MONITOR_API_KEY`; if unset the route answers 500 (it will not
 * silently expose operational data).
 */
@injectable()
export class MonitorAuthMiddleware implements IMiddleware {
  async handle(req: Request, res: Response, _container: DependencyContainer): Promise<void> {
    const expected = process.env.MONITOR_API_KEY
    if (!expected) {
      throw new CustomError({
        httpCode: 500,
        message: 'MONITOR_API_KEY is not configured — set it to protect the monitor.',
      })
    }

    const fromQuery = typeof req.query.key === 'string' ? req.query.key : undefined
    const fromCookie = readCookie(req.headers.cookie, COOKIE_NAME)
    const presented = fromQuery ?? fromCookie

    if (presented !== expected) {
      throw new CustomError({ httpCode: 401, message: 'Unauthorized' })
    }

    if (fromQuery && fromCookie !== expected) {
      res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${encodeURIComponent(expected)}; Path=/; HttpOnly; SameSite=Strict`,
      )
    }
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}
