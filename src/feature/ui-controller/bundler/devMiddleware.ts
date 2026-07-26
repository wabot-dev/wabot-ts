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

  app.use(mountPath, async (req: Request, res: Response, next) => {
    const servePath = mountPath + req.path
    const file = await bundler.getFile(servePath)
    if (!file) {
      // An asset that a rebuild renamed away. Answering with the app's HTML 404
      // would hand a module script something it cannot parse, so reply in the
      // asset's own language and say why in the console.
      const notice = `[wabot] dev asset not found: ${servePath}`
      if (req.path.endsWith('.css')) {
        res.status(404).type('text/css').send(`/* ${notice} */`)
        return
      }
      if (req.path.endsWith('.js')) {
        res
          .status(404)
          .type('text/javascript')
          .send(`console.error(${JSON.stringify(notice)})`)
        return
      }
      return next()
    }
    res.set('Content-Type', file.type)
    // Chunk URLs carry a hash of their contents, so they can be cached hard;
    // entry URLs are stable across rebuilds and must be revalidated.
    res.set('Cache-Control', file.immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.send(Buffer.from(file.contents))
  })

  logger.info(`serving island assets at ${base} (live reload via ${liveReloadPath})`)
}
