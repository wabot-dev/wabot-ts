import { CustomError } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateAndTransform } from '@/core/validation'
import { ExpressProvider } from '@/feature/express'
import { Request, json, urlencoded } from 'express'
import path from 'path'
import { EXPRESS_REQ, EXPRESS_RES } from './injection-tokens'
import { RestControllerMetadataStore } from './metadata'

function buildRequest(req: Request): any {
  return Object.assign({}, req.body, req.query, req.params)
}

export function runRestControllers(controllers: IConstructor<any>[]) {
  const logger = new Logger('wabot:rest')
  const metadataStore = container.resolve(RestControllerMetadataStore)
  const expressProvider = container.resolve(ExpressProvider)

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
        const requestContainer = container.createChildContainer()
        requestContainer.register(EXPRESS_REQ, { useValue: req })
        requestContainer.register(EXPRESS_RES, { useValue: req })
        try {
          const middlewares = endPoint.middlewares.map((x) =>
            requestContainer.resolve(x.middlewareConstructor),
          )
          for (const middleware of middlewares) {
            await middleware.handle(req, res, requestContainer)
          }

          const controllerInstance = requestContainer.resolve(endPoint.controllerConstructor)
          const endPointArgs = [] as any
          let defaultArgFound = false

          for (let paramIndex = 0; paramIndex < endPoint.paramsTypes.length; paramIndex++) {
            const paramType = endPoint.paramsTypes[paramIndex]
            if (defaultArgFound) {
              throw new Error(`Cant determine de parameter ${paramIndex} value`)
            }
            defaultArgFound = true
            if (typeof paramType === 'function') {
              const { value, error } = validateAndTransform(buildRequest(req), paramType)
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
          res.status(200).json(response)
        } catch (err) {
          logger.error(err)
          if (err instanceof Error) {
            const keys = Object.keys(err).filter((key) => !['message', 'stack'].includes(key))
            const { httpCode, ...info } = keys.reduce(
              (acc, key) => {
                acc[key] = (err as any)[key]
                return acc
              },
              {} as { [key: string]: any },
            )
            res
              .status(httpCode ?? 500)
              .json(removeCircular({ error: { message: err.message, stack: err.stack, ...info } }))
          } else {
            res.status(500).json({ error: { message: 'Unknown error' } })
          }
        } finally {
          requestContainer.dispose()
        }
      })
    })
  })

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
