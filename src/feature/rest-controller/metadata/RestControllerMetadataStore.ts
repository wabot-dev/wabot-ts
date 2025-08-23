import { IEndPointMetadata } from './IEndPointMetadata'
import { IRestControllerMetadata } from './IRestControllerMetadata'
import { IConstructor } from '@/core/generics'
import { IMiddlewareMetadata } from './IMiddlewareMetadata'
import { singleton } from '@/core/injection'

@singleton()
export class RestControllerMetadataStore {
  private endPoints = new Map<Function, Map<string, IEndPointMetadata>>()
  private middlewares = new Map<Function, Map<string, IMiddlewareMetadata[]>>()
  private restControllers = new Map<Function, IRestControllerMetadata>()

  saveControllerMetadata(controllerMetadata: IRestControllerMetadata) {
    this.restControllers.set(controllerMetadata.controllerConstructor, controllerMetadata)
  }

  saveEndPointMetadata(endPointMetadata: IEndPointMetadata) {
    let controllerEndPoints = this.endPoints.get(endPointMetadata.controllerConstructor)
    if (!controllerEndPoints) {
      this.endPoints.set(endPointMetadata.controllerConstructor, (controllerEndPoints = new Map()))
    }
    controllerEndPoints.set(endPointMetadata.functionName, endPointMetadata)
  }

  saveMiddlewareMetadata(middlewareMetadata: IMiddlewareMetadata) {
    let controllerMiddlewares = this.middlewares.get(middlewareMetadata.controllerConstructor)
    if (!controllerMiddlewares) {
      this.middlewares.set(
        middlewareMetadata.controllerConstructor,
        (controllerMiddlewares = new Map()),
      )
    }
    let methodMiddlewares = controllerMiddlewares.get(middlewareMetadata.functionName)
    if (!methodMiddlewares) {
      controllerMiddlewares.set(middlewareMetadata.functionName, (methodMiddlewares = []))
    }
    methodMiddlewares.unshift(middlewareMetadata)
  }

  getControllerEndPointsInfo(controllerConstructor: IConstructor<any>) {
    const controller = this.restControllers.get(controllerConstructor)
    if (!controller) {
      throw new Error(`${controllerConstructor.name} should be decorated with @restController`)
    }

    const endPoints = this.endPoints.get(controllerConstructor)

    if (!endPoints?.size) {
      // TODO: Warning
      return []
    }

    return [...endPoints.values()].map((endPoint) => ({
      ...endPoint,
      middlewares:
        this.middlewares.get(endPoint.controllerConstructor)?.get(endPoint.functionName) ?? [],
      controller: this.restControllers.get(endPoint.controllerConstructor)!,
    }))
  }
}
