import { CustomError, errorToPlainObject } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateModel, ValidationMetadataStore } from '@/core/validation'
import { ExpressProvider } from '@/feature/express'
import { EXPRESS_REQ, EXPRESS_RES, IMiddleware } from '@/feature/rest-controller'
import { json, urlencoded, Request, Response } from 'express'
import path from 'node:path'
import { UiControllerMetadataStore } from './metadata'
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
    store.getControllerViewsInfo(controller).forEach((view) => {
      const route = joinRoute(view.controller.path, view.config?.path ?? '')
      const middlewareCtors = [
        ...view.controller.middlewares,
        ...view.middlewares.map((m) => m.middlewareConstructor),
      ]
      logger.info(`view  GET  ${route}`)

      expressApp.get(route, json(), urlencoded({ extended: true }), async (req, res) => {
        const requestContainer = newRequestContainer(baseContainer, req, res)
        try {
          if (await runMiddlewares(middlewareCtors, requestContainer, req, res)) return

          const instance = requestContainer.resolve(view.controllerConstructor)
          const args = resolveHandlerArgs(view.paramsTypes, req, validationStore)
          const result = await (instance[view.functionName] as Function).apply(instance, args)

          if (isRedirect(result)) {
            res.redirect(result.status, result.location)
            return
          }

          const renderer = rendererRegistry.get()
          const rendered = await renderer.renderToString(result, { dev })
          const assets = options.pageAssets?.(rendered.islands) ?? {}
          const html = renderDocument({
            bodyHtml: rendered.html,
            title: view.config?.title,
            meta: view.config?.meta,
            styles: [...(rendered.styles ?? []), ...(assets.styles ?? [])],
            scripts: assets.scripts ?? [],
            headHtml: assets.headHtml,
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
