import { ExpressProvider } from '@/channels'
import { IConstructor } from '@/core'
import { DependencyContainer } from '@/injection'
import { Logger } from '@/logger'
import { validate } from '@/validation'
import { Request } from 'express'
import path from 'path'
import { RestControllerMetadataStore } from './metadata'
import { CustomError } from '@/error'

function buildRequest(req: Request): any {
  return Object.assign({}, req.body, req.query, req.params)
}

export function runRestControllers(
  controllers: IConstructor<any>[],
  container: DependencyContainer,
) {
  const logger = new Logger('wabot:rest')
  const metadataStore = container.resolve(RestControllerMetadataStore)
  const expressProvider = container.resolve(ExpressProvider)

  const expressApp = expressProvider.getExpress()

  controllers.forEach((controller) => {
    const endPoints = metadataStore.getControllerEndPointsInfo(controller)
    endPoints.forEach((endPoint) => {
      const method = endPoint.method
      const route = path.join(endPoint.controller.path, endPoint.path ?? '')
      logger.info(`config ${endPoint.method.toUpperCase()} ${route}`)
      expressApp[method](route, async (req, res) => {
        const requestContainer = container.createChildContainer()
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
              const { value, error } = validate(buildRequest(req), paramType)
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
              .json({ error: { message: err.message, stack: err.stack, ...info } })
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
