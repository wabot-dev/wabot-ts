import { CustomError, errorToPlainObject } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateModel, ValidationMetadataStore } from '@/core/validation'
import { ExpressProvider } from '@/feature/express'
import { EXPRESS_REQ, EXPRESS_RES, IMiddleware } from '@/feature/rest-controller'
import { json, urlencoded, Request, Response } from 'express'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { UiControllerMetadataStore } from './metadata'
import type { IControllerHead } from './metadata/IUiControllerConfig'
import { IRenderedIsland, UiRendererRegistry } from './renderer'
import { isRedirect, renderDocument, escapeHtml } from './document'

function buildRequest(req: Request): any {
  return Object.assign({}, req.body, req.query, req.params)
}

function joinRoute(...parts: string[]): string {
  return path.join(...parts).replaceAll('\\', '/')
}

/** Page-level assets (scripts/styles) to inject, computed from the islands a view rendered. */
export interface IPageAssets {
  scripts?: string[]
  styles?: string[]
  headHtml?: string
  bodyEndHtml?: string
  /** URL of the boosted-navigation runtime; injected on `app: true` pages. */
  navScript?: string
}

/** Header the client nav runtime sends to request a fragment instead of a full document. */
const NAV_HEADER = 'X-Wabot-Nav'

/** Canonical form of a route path: leading slash, no trailing slash (except root). */
function normalizeRoutePath(routePath: string): string {
  return '/' + routePath.replace(/^\/+|\/+$/g, '')
}

/** Turn a controller's head hints into <link> attribute maps for renderDocument. */
function headLinks(head?: IControllerHead): Array<Record<string, string | boolean>> | undefined {
  if (!head) return undefined
  const links: Array<Record<string, string | boolean>> = []

  for (const entry of head.preconnect ?? []) {
    const { href, crossorigin } =
      typeof entry === 'string' ? { href: entry, crossorigin: undefined } : entry
    links.push({ rel: 'preconnect', href, ...(crossorigin ? { crossorigin: true } : {}) })
  }

  for (const p of head.preload ?? []) {
    // Fonts are always fetched cross-origin; default crossorigin so the preload
    // matches the real request instead of fetching the font twice.
    const crossorigin = p.crossorigin ?? (p.as === 'font' ? true : undefined)
    links.push({
      rel: 'preload',
      href: p.href,
      as: p.as,
      ...(p.type ? { type: p.type } : {}),
      ...(crossorigin ? { crossorigin } : {}),
      ...(p.media ? { media: p.media } : {}),
    })
  }

  return links.length ? links : undefined
}

export interface IRegisterUiControllersOptions {
  baseContainer?: DependencyContainer
  expressProvider?: ExpressProvider
  /** Hook used by the bundler/dev server to inject island client bundles + CSS. */
  pageAssets?: (islands: IRenderedIsland[]) => IPageAssets
}

export function registerUiControllers(
  controllers: IConstructor<any>[],
  options: IRegisterUiControllersOptions = {},
): ExpressProvider {
  const logger = new Logger('wabot:ui')
  const baseContainer = options.baseContainer ?? container
  const store = baseContainer.resolve(UiControllerMetadataStore)
  const expressProvider = options.expressProvider ?? baseContainer.resolve(ExpressProvider)
  const validationStore = baseContainer.resolve(ValidationMetadataStore)
  const rendererRegistry = baseContainer.resolve(UiRendererRegistry)
  const expressApp = expressProvider.getExpress()
  const dev = process.env.NODE_ENV !== 'production'

  controllers.forEach((controller) => {
    const viewInfos = store.getControllerViewsInfo(controller)
    // The exact view routes of this controller: the nav runtime soft-navigates
    // only these, so a controller mounted at "/" doesn't hijack the whole origin.
    const appRoutes = viewInfos.map((v) =>
      normalizeRoutePath(joinRoute(v.controller.path, v.config?.path ?? '')),
    )

    viewInfos.forEach((view) => {
      const route = joinRoute(view.controller.path, view.config?.path ?? '')
      const middlewareCtors = [
        ...view.controller.middlewares,
        ...view.middlewares.map((m) => m.middlewareConstructor),
      ]
      logger.info(`view  GET  ${route}`)

      // A parameterized view under boosted nav needs an swr.version(params) so
      // revalidation keys off the parameter; otherwise it can only revalidate by
      // hashing a full re-render on every visit.
      const isParameterized = route.split('/').some((seg) => seg.startsWith(':'))
      if (view.controller.app && isParameterized && !view.config?.swr?.version) {
        logger.warn(
          `view GET ${route}: parameterized app views should declare swr.version(params) ` +
            `so boosted navigation can revalidate per parameter without re-rendering`,
        )
      }

      expressApp.get(route, json(), urlencoded({ extended: true }), async (req, res) => {
        const requestContainer = newRequestContainer(baseContainer, req, res)
        try {
          if (await runMiddlewares(middlewareCtors, requestContainer, req, res)) return

          const isApp = view.controller.app === true
          const softNav = isApp && !!req.get(NAV_HEADER)

          // Cheap revalidation: if the view declares a `version`, answer 304
          // without running the handler or SSR when it matches If-None-Match.
          let versionEtag: string | undefined
          if (softNav && view.config?.swr?.version) {
            const version = await view.config.swr.version(buildRequest(req))
            versionEtag = `"v:${version}"`
            res.set('ETag', versionEtag)
            res.set('Cache-Control', 'no-cache')
            if (req.get('If-None-Match') === versionEtag) {
              res.status(304).end()
              return
            }
          }

          const instance = requestContainer.resolve(view.controllerConstructor)
          const args = resolveHandlerArgs(view.paramsTypes, req, validationStore)
          const result = await (instance[view.functionName] as Function).apply(instance, args)

          if (isRedirect(result)) {
            res.redirect(result.status, result.location)
            return
          }

          const renderer = rendererRegistry.get()
          // Full loads render inside the controller's layout (the persistent
          // shell); boosted-nav fragments render just the view (the outlet body).
          const rendered = await renderer.renderToString(result, {
            dev,
            layout: softNav ? undefined : view.controller.layout,
          })
          const assets = options.pageAssets?.(rendered.islands) ?? {}
          const styles = [...(rendered.styles ?? []), ...(assets.styles ?? [])]

          // Boosted navigation: send a JSON fragment (+ ETag) instead of the
          // full document. A matching If-None-Match means nothing changed, so
          // answer 304 and let the client keep its cached view (no re-render).
          if (softNav) {
            const payload = JSON.stringify({
              html: rendered.html,
              title: view.config?.title ?? null,
              meta: view.config?.meta ?? null,
              scripts: assets.scripts ?? [],
              styles,
              maxAge: view.config?.swr?.maxAge ?? 0,
            })
            const etag = versionEtag ?? `"${createHash('sha1').update(payload).digest('base64')}"`
            res.set('ETag', etag)
            res.set('Cache-Control', 'no-cache')
            if (req.get('If-None-Match') === etag) {
              res.status(304).end()
              return
            }
            res.status(200).type('application/json').send(payload)
            return
          }

          const scripts = [...(assets.scripts ?? [])]
          let headHtml = assets.headHtml
          // Inline the collected `*.module.css` so scoped class names (views and
          // islands) are styled server-side, matching the hydrated markup.
          if (rendered.moduleCss) {
            headHtml = (headHtml ?? '') + `<style>${rendered.moduleCss}</style>`
          }
          if (isApp && assets.navScript) {
            // `<` escaped so a route string can never break out of the inline script.
            const bootstrap = `<script>window.__wabotApp=${JSON.stringify({
              routes: appRoutes,
            }).replace(/</g, '\\u003c')}</script>`
            headHtml = (headHtml ?? '') + bootstrap
            scripts.push(assets.navScript)
          }

          const html = renderDocument({
            bodyHtml: rendered.html,
            title: view.config?.title,
            meta: view.config?.meta,
            styles,
            links: headLinks(view.controller.head),
            scripts,
            headHtml,
            bodyEndHtml: assets.bodyEndHtml,
          })
          res.status(200).type('html').send(html)
        } catch (err) {
          sendHtmlError(res, err, logger, `GET ${route}`, dev)
        } finally {
          requestContainer.dispose()
        }
      })
    })

    store.getControllerActionsInfo(controller).forEach((action) => {
      const route = joinRoute(
        action.controller.path,
        '_action',
        action.config?.path ?? action.functionName,
      )
      const middlewareCtors = [
        ...action.controller.middlewares,
        ...action.middlewares.map((m) => m.middlewareConstructor),
      ]
      logger.info(`action POST ${route}`)

      expressApp.post(route, json(), urlencoded({ extended: true }), async (req, res) => {
        const requestContainer = newRequestContainer(baseContainer, req, res)
        try {
          if (await runMiddlewares(middlewareCtors, requestContainer, req, res)) return

          const instance = requestContainer.resolve(action.controllerConstructor)
          const args = resolveHandlerArgs(action.paramsTypes, req, validationStore)
          const result = await (instance[action.functionName] as Function).apply(instance, args)

          if (isRedirect(result)) {
            res.redirect(result.status, result.location)
            return
          }
          res.status(200).json(removeCircular(result ?? null))
        } catch (err) {
          sendJsonError(res, err, logger, `POST ${route}`)
        } finally {
          requestContainer.dispose()
        }
      })
    })
  })

  return expressProvider
}

export function runUiControllers(
  controllers: IConstructor<any>[],
  options: IRegisterUiControllersOptions = {},
) {
  const expressProvider = registerUiControllers(controllers, options)
  expressProvider.listen()
}

function newRequestContainer(
  baseContainer: DependencyContainer,
  req: Request,
  res: Response,
): DependencyContainer {
  const requestContainer = baseContainer.createChildContainer()
  requestContainer.register(Container, { useValue: requestContainer })
  requestContainer.register(EXPRESS_REQ, { useValue: req })
  requestContainer.register(EXPRESS_RES, { useValue: res })
  return requestContainer
}

/** Returns true if a middleware already handled the response (caller should stop). */
async function runMiddlewares(
  middlewareCtors: IConstructor<IMiddleware>[],
  requestContainer: DependencyContainer,
  req: Request,
  res: Response,
): Promise<boolean> {
  for (const ctor of middlewareCtors) {
    const middleware = requestContainer.resolve(ctor)
    await middleware.handle(req, res, requestContainer)
    if (res.headersSent) return true
  }
  return false
}

function resolveHandlerArgs(
  paramsTypes: any[] | undefined,
  req: Request,
  validationStore: ValidationMetadataStore,
): any[] {
  if (!paramsTypes || paramsTypes.length === 0) return []
  if (paramsTypes.length > 1) {
    throw new Error('ui view/action handlers accept at most one parameter')
  }
  const paramType = paramsTypes[0]
  if (typeof paramType !== 'function') {
    throw new Error('invalid ui handler parameter type')
  }
  const paramInfo = validationStore.getModelValidatorsInfo(paramType)
  const { value, error } = validateModel(buildRequest(req), paramInfo)
  if (error) {
    throw new CustomError({ httpCode: 400, message: error.description, info: error })
  }
  return [value]
}

function sendHtmlError(
  res: Response,
  err: unknown,
  logger: Logger,
  label: string,
  dev: boolean,
): void {
  logger.error(`${label} failed`, err)
  if (res.headersSent) return
  const status = err instanceof Error ? (errorToPlainObject(err).httpCode ?? 500) : 500
  const message = err instanceof Error ? err.message : 'Unknown error'
  const detail =
    dev && err instanceof Error && err.stack ? `<pre>${escapeHtml(err.stack)}</pre>` : ''
  const html = renderDocument({
    title: `Error ${status}`,
    bodyHtml: `<main><h1>Error ${status}</h1><p>${escapeHtml(message)}</p>${detail}</main>`,
  })
  res.status(status).type('html').send(html)
}

function sendJsonError(res: Response, err: unknown, logger: Logger, label: string): void {
  logger.error(`${label} failed`, err)
  if (res.headersSent) return
  if (err instanceof Error) {
    const { name: _name, stack, httpCode, ...info } = errorToPlainObject(err)
    res
      .status(httpCode ?? 500)
      .json(removeCircular({ error: { message: err.message, stack, ...info } }))
  } else {
    res.status(500).json({ error: { message: 'Unknown error' } })
  }
}

function removeCircular(obj: any, seen = new WeakSet()): any {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) return undefined
    seen.add(obj)
    const clone: any = Array.isArray(obj) ? [] : {}
    for (const key in obj) {
      clone[key] = removeCircular(obj[key], seen)
    }
    return clone
  }
  return obj
}
