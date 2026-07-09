import type { DependencyContainer } from '@/core/injection'
import { injectable } from '@/core/injection'
import { CustomError } from '@/core/error'
import { IMiddleware } from '@/feature/rest-controller'
import type { Request, Response } from 'express'

/**
 * API-key guard for the monitor page. Accepts the key via the `?key=` query
 * param — a browser navigation cannot send an Authorization header, so the
 * framework's header-based guard is unusable here. The expected key is
 * `process.env.MONITOR_API_KEY`; if unset the route answers 500 (misconfiguration)
 * rather than silently exposing operational data.
 */
@injectable()
export class MonitorAuthMiddleware implements IMiddleware {
  async handle(req: Request, _res: Response, _container: DependencyContainer): Promise<void> {
    const expected = process.env.MONITOR_API_KEY
    if (!expected) {
      throw new CustomError({
        httpCode: 500,
        message: 'MONITOR_API_KEY is not configured — set it to protect the monitor.',
      })
    }
    const key = typeof req.query.key === 'string' ? req.query.key : undefined
    if (key !== expected) {
      throw new CustomError({ httpCode: 401, message: 'Unauthorized' })
    }
  }
}
