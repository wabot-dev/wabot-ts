import { Request, Response } from 'express'

import { CustomError } from '@/core/error'
import { DependencyContainer, injectable } from '@/core/injection'
import { IRateLimitOptions, RateLimiter } from '@/core/rate-limit'
import { IMiddleware } from './IMiddleware'
import { middleware } from './metadata/@middleware'

export interface IRateLimitDecoratorOptions extends IRateLimitOptions {
  /**
   * Derive the bucket key from the request. Defaults to per-route-per-client-IP.
   * Override to limit per user, per API key, etc.
   */
  key?: (req: Request) => string
}

function defaultKey(req: Request): string {
  const route = `${req.baseUrl ?? ''}${req.path ?? ''}`
  return `ratelimit:${route}:${req.ip ?? 'unknown'}`
}

/**
 * Rate-limit a REST endpoint. Counts each request against a fixed window and,
 * when the limit is exceeded, sets `Retry-After` and throws HTTP 429. Sets
 * `X-RateLimit-Limit` / `X-RateLimit-Remaining` on every response. The backend
 * (in-memory or Postgres) is chosen by the project runner.
 *
 * ```typescript
 * @onPost()
 * @rateLimit({ limit: 20, windowSeconds: 60 })
 * async create(req: CreateThingRequest) { ... }
 * ```
 */
export function rateLimit(options: IRateLimitDecoratorOptions) {
  @injectable()
  class RateLimitMiddleware implements IMiddleware {
    async handle(req: Request, res: Response, container: DependencyContainer): Promise<void> {
      const limiter = container.resolve(RateLimiter)
      const key = options.key ? options.key(req) : defaultKey(req)
      const result = await limiter.hit(key, options)

      res.setHeader('X-RateLimit-Limit', String(result.limit))
      res.setHeader('X-RateLimit-Remaining', String(result.remaining))

      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))
        res.setHeader('Retry-After', String(retryAfter))
        throw new CustomError({
          httpCode: 429,
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        })
      }
    }
  }

  return middleware(RateLimitMiddleware)
}
