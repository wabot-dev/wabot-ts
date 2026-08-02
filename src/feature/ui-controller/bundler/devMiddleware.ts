import type { Express, Request, Response } from 'express'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { Logger } from '@/core/logger'
import { UiBundler } from './UiBundler'

export interface IUiDevAssetsOptions {
  /** URL prefix the bundler serves under. Default "/_wabot/". */
  base?: string
  /** SSE endpoint used for live reload. Default "/_wabot/livereload". */
  liveReloadPath?: string
  /**
   * Preferred port for the live-reload server. Taken ports are skipped, so
   * several apps can run at once. Default `PORT + 1`.
   */
  liveReloadPort?: number
  /** How many ports to probe from the preferred one before giving up. Default 20. */
  liveReloadPortAttempts?: number
}

export interface IUiDevAssets {
  /** Port the live-reload SSE server ended up on. */
  liveReloadPort: number
  /**
   * Answer for an asset URL nothing else claimed. Call it **after** every other
   * route under the prefix is registered — it ends the request, so anything
   * mounted under `/_wabot/` afterwards would never be reached. Optional: skip
   * it and a missing asset falls through to the app's own 404.
   */
  mountNotFound(): void
  /** Stop the live-reload server and drop its open connections. */
  close(): Promise<void>
}

/** Resolve on success, false when the port is taken, reject on any other error. */
function tryListen(server: Server, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const onError = (err: unknown) => {
      server.removeListener('listening', onListening)
      if ((err as { code?: string }).code === 'EADDRINUSE') {
        resolve(false)
        return
      }
      reject(err)
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve(true)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port)
  })
}

/**
 * Bind the first free port at or above `preferred`. Falls back to an ephemeral
 * port so a crowded range never stops the dev server from booting.
 */
async function listenOnFreePort(
  server: Server,
  preferred: number,
  attempts: number,
): Promise<number> {
  for (let port = preferred; port < preferred + attempts; port++) {
    if (await tryListen(server, port)) {
      return boundPort(server)
    }
  }
  await tryListen(server, 0)
  return boundPort(server)
}

/** The port actually bound — `listen(0)` picks one, so the request is not the answer. */
function boundPort(server: Server): number {
  const address = server.address()
  return typeof address === 'object' && address ? address.port : 0
}

/**
 * Mounts the dev island assets on the shared Express app, and the live-reload
 * SSE endpoint on a **separate port**. That endpoint holds one connection open
 * per open page, and browsers cap HTTP/1.1 at ~6 connections per origin across
 * all tabs — kept on the app's origin, a handful of tabs would starve the
 * asset, action and API requests of the very same app. Its own origin means
 * its own connection pool.
 *
 * Each successful rebuild pushes a "reload" event to connected pages (the
 * snippet from {@link liveReloadSnippet} listens for it).
 */
export async function mountUiDevAssets(
  app: Express,
  bundler: UiBundler,
  options: IUiDevAssetsOptions = {},
): Promise<IUiDevAssets> {
  const logger = new Logger('wabot:ui:dev')
  const base = options.base ?? '/_wabot/'
  const mountPath = base.replace(/\/$/, '')
  const liveReloadPath = options.liveReloadPath ?? '/_wabot/livereload'

  const clients = new Set<ServerResponse>()
  bundler.onRebuild(() => {
    for (const res of clients) res.write('data: reload\n\n')
  })

  const liveReloadServer = createServer((req, res) => {
    // Served cross-origin (different port), and read by a plain EventSource:
    // a simple GET, so `*` is all the CORS this needs.
    res.setHeader('Access-Control-Allow-Origin', '*')
    if ((req.url ?? '').split('?')[0] !== liveReloadPath) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write('data: connected\n\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
  })

  const preferredPort = options.liveReloadPort ?? Number(process.env.PORT || 3000) + 1
  const liveReloadPort = await listenOnFreePort(
    liveReloadServer,
    preferredPort,
    options.liveReloadPortAttempts ?? 20,
  )
  // Never keep the process alive on its own account: the app's own server is
  // what decides how long dev runs.
  liveReloadServer.unref()

  // Comment lines keep intermediaries from dropping an idle stream.
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n')
  }, 30_000)
  heartbeat.unref()

  // The bundler shares `/_wabot/` with routes registered later — the plain-CSS
  // asset registry among them — so a URL it does not serve has to fall through
  // rather than be answered here. Ending the request on a miss made this
  // handler the owner of the whole prefix and 404'd every one of those routes.
  app.use(mountPath, async (req: Request, res: Response, next) => {
    const file = await bundler.getFile(mountPath + req.path)
    if (!file) return next()
    res.set('Content-Type', file.type)
    // Chunk URLs carry a hash of their contents, so they can be cached hard;
    // entry URLs are stable across rebuilds and must be revalidated.
    res.set('Cache-Control', file.immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.send(Buffer.from(file.contents))
  })

  const mountNotFound = () => {
    app.use(mountPath, (req: Request, res: Response, next) => {
      // An asset that a rebuild renamed away, once everything else has passed.
      // Answering with the app's HTML 404 would hand a module script something
      // it cannot parse, so reply in the asset's own language and say why in
      // the console.
      const notice = `[wabot] dev asset not found: ${mountPath + req.path}`
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
      next()
    })
  }

  logger.info(`serving island assets at ${base} (live reload on port ${liveReloadPort})`)

  return {
    liveReloadPort,
    mountNotFound,
    close: async () => {
      clearInterval(heartbeat)
      for (const res of clients) res.end()
      clients.clear()
      await new Promise<void>((resolve) => liveReloadServer.close(() => resolve()))
    },
  }
}
