import { IConstructor } from '@/core'
import { DependencyContainer } from '@/injection'
import { RestControllerMetadataStore } from './metadata'
import { ExpressProvider } from '@/channels'
import path from 'path'
import { Logger } from '@/logger'
import { Request } from 'express'

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
        const controllerInstance = requestContainer.resolve(endPoint.controllerConstructor)

        const endPointArgs = [] as any
        let defaultArgFound = false
        for (let paramIndex = 0; paramIndex < endPoint.paramsTypes.length; paramIndex++) {
          const paramType = endPoint.paramsTypes[paramIndex]
          if (defaultArgFound) {
            throw new Error(`Cant determine de parameter ${paramIndex} value`)
          }
          defaultArgFound = true
          if (typeof paramType === 'function' && typeof paramType.__validate__ === 'function') {
            const { value, error } = paramType.__validate__(buildRequest(req))
            debugger
            if (error) {
              res.status(400).json({ error })
              return
            }
            endPointArgs.push(value)
          }
        }

        try {
          const response = await (controllerInstance[endPoint.functionName] as Function).apply(
            controllerInstance,
            endPointArgs,
          )
          res.status(200).json(response)
        } catch (err) {
          res.sendStatus(500)
        }
        requestContainer.dispose()
      })
    })
  })

  expressProvider.listen()
}
