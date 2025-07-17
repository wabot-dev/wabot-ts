import { IConstructor } from '@/core'
import { DependencyContainer } from '@/injection'
import { RestControllerMetadataStore } from './metadata'
import { ExpressProvider } from '@/channels'
import path from 'path'

export function runRestControllers(
  controllers: IConstructor<any>[],
  container: DependencyContainer,
) {
  const metadataStore = container.resolve(RestControllerMetadataStore)
  const expressProvider = container.resolve(ExpressProvider)

  const expressApp = expressProvider.getExpress()

  controllers.forEach((controller) => {
    const endPoints = metadataStore.getControllerEndPointsInfo(controller)
    endPoints.forEach((endPoint) => {
      expressApp[endPoint.method](
        path.join(endPoint.controller.path, endPoint.path ?? ''),
        async (req, res) => {
          const requestContainer = container.createChildContainer()
          const controllerInstance = requestContainer.resolve(endPoint.controllerConstructor)
          try {
            const response = await (controllerInstance[endPoint.functionName] as Function).apply(
              controllerInstance,
              [],
            )
            res.status(200).json(response)
          } catch (err) {
            res.sendStatus(500)
          }
          requestContainer.dispose()
        },
      )
    })
  })

  expressProvider.listen()
}
