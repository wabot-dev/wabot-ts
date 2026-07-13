import { CustomError, errorToPlainObject } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateModel, ValidationMetadataStore } from '@/core/validation'
import { ExpressProvider } from '@/feature/express'
import { Request, json, urlencoded } from 'express'
import path from 'node:path'
import { EXPRESS_REQ, EXPRESS_RES } from './injection-tokens'
import { RestControllerMetadataStore } from './metadata'
import { RestRequest } from './RestRequest'
import { IncomingMessage } from 'node:http'

function buildRequest(req: Request): any {
  return Object.assign({}, req.body, req.query, req.params)
}

export interface IRegisterRestControllersOptions {
  /** Container the per-request child containers derive from. */
  baseContainer?: DependencyContainer
  /** Express provider to mount the routes on. */
  expressProvider?: ExpressProvider
}

export function registerRestControllers(
  controllers: IConstructor<any>[],
  options: IRegisterRestControllersOptions = {},
): ExpressProvider {
  const logger = new Logger('wabot:rest')
  const baseContainer = options.baseContainer ?? container
  const metadataStore = baseContainer.resolve(RestControllerMetadataStore)
  const expressProvider = options.expressProvider ?? baseContainer.resolve(ExpressProvider)
  const validationMetadataStore = baseContainer.resolve(ValidationMetadataStore)

  const expressApp = expressProvider.getExpress()

  controllers.forEach((controller) => {
    const endPoints = metadataStore.getControllerEndPointsInfo(controller)
    endPoints.forEach((endPoint) => {
      const method = endPoint.method
      const route = path
        .join(endPoint.controller.path, endPoint.config?.path ?? '')
        .replaceAll('\\', '/')
      logger.info(`config ${endPoint.method.toUpperCase()} ${route}`)
      const rawMiddlewares = []
      if (!endPoint.config?.disableJsonParser) {
        rawMiddlewares.push(json())
      }
      if (!endPoint.config?.disableUrlEncodedParser) {
        rawMiddlewares.push(urlencoded({ extended: true }))
      }
      expressApp[method](route, ...rawMiddlewares, async (req, res) => {
        const requestContainer = baseContainer.createChildContainer()
        requestContainer.register(Container, { useValue: requestContainer })
        requestContainer.register(EXPRESS_REQ, { useValue: req })
        requestContainer.register(EXPRESS_RES, { useValue: res })
        try {
          const middlewares = endPoint.middlewares.map((x) =>
            requestContainer.resolve(x.middlewareConstructor),
          )
          for (const middleware of middlewares) {
            await middleware.handle(req, res, requestContainer)
          }

          const controllerInstance = requestContainer.resolve(endPoint.controllerConstructor)
          const endPointArgs: any[] = []

          if (endPoint.paramsTypes.length > 1) {
            throw new Error(`rest controller endpoints should have zero or one parameter only`)
          }

          if (endPoint.paramsTypes.length === 1) {
            const paramType = endPoint.paramsTypes[0]

            if (paramType === IncomingMessage) {
              endPointArgs.push(req)
            } else {
              if (typeof paramType !== 'function') {
                throw new Error(`invalid rest controller endpoint parameter type`)
              }
              const paramInfo = validationMetadataStore.getModelValidatorsInfo(paramType)

              const validableReq = paramInfo.modelHierarchy.includes(RestRequest)
                ? req
                : buildRequest(req)
              const { value, error } = validateModel(validableReq, paramInfo)
              if (error) {
                throw new CustomError({ httpCode: 400, message: error.description, info: error })
              }
              endPointArgs.push(value)
            }
          }

          const response = await (controllerInstance[endPoint.functionName] as Function).apply(
            controllerInstance,
            endPointArgs,
          )
          // A handler that wrote the response itself (via @inject(EXPRESS_RES),
          // e.g. to stream or send a non-JSON body) has already answered.
          if (!res.headersSent) {
            res.status(200).json(response ?? null)
          }
        } catch (err) {
          logger.error(`${method.toUpperCase()} ${route} failed`, err)
          if (err instanceof Error) {
            const { name: _name, stack, httpCode, ...info } = errorToPlainObject(err)
            res
              .status(httpCode ?? 500)
              .json(removeCircular({ error: { message: err.message, stack, ...info } }))
          } else {
            res.status(500).json({ error: { message: 'Unknown error' } })
          }
        } finally {
          requestContainer.dispose()
        }
      })
    })
  })

  return expressProvider
}

export function runRestControllers(controllers: IConstructor<any>[]) {
  const expressProvider = registerRestControllers(controllers)
  expressProvider.listen()
}

function removeCircular(obj: any, seen = new WeakSet()) {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) {
      return undefined // remove circular ref
    }
    seen.add(obj)
    const clone: any = Array.isArray(obj) ? [] : {}
    for (const key in obj) {
      clone[key] = removeCircular(obj[key], seen)
    }
    return clone
  }
  return obj
}
