import type { Express, Request, Response } from 'express'
import { Logger } from '@/core/logger'
import { UiBundler } from './UiBundler'

export interface IUiDevAssetsOptions {
  /** URL prefix the bundler serves under. Default "/_wabot/". */
  base?: string
  /** SSE endpoint used for live reload. Default "/_wabot/livereload". */
  liveReloadPath?: string
}

/**
 * Mounts the dev island assets and a live-reload SSE endpoint on the shared
 * Express app. Each successful rebuild pushes a "reload" event to connected
 * pages (the snippet from {@link liveReloadSnippet} listens for it).
 */
export function mountUiDevAssets(
  app: Express,
  bundler: UiBundler,
  options: IUiDevAssetsOptions = {},
): void {
  const logger = new Logger('wabot:ui:dev')
  const base = options.base ?? '/_wabot/'
  const mountPath = base.replace(/\/$/, '')
  const liveReloadPath = options.liveReloadPath ?? '/_wabot/livereload'

  const clients = new Set<Response>()
  bundler.onRebuild(() => {
    for (const res of clients) res.write('data: reload\n\n')
  })

  app.get(liveReloadPath, (req: Request, res: Response) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.flushHeaders?.()
    res.write('data: connected\n\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
  })

  app.use(mountPath, (req: Request, res: Response, next) => {
    const servePath = mountPath + req.path
    const file = bundler.getFile(servePath)
    if (!file) return next()
    res.set('Content-Type', file.type)
    res.set('Cache-Control', 'no-cache')
    res.send(Buffer.from(file.contents))
  })

  logger.info(`serving island assets at ${base} (live reload via ${liveReloadPath})`)
}
