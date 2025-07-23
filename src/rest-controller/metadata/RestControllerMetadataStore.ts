import { singleton } from 'tsyringe'
import { IEndPointMetadata } from './IEndPointMetadata'
import { IRestControllerMetadata } from './IRestControllerMetadata'
import { IConstructor } from '@/core'

@singleton()
export class RestControllerMetadataStore {
  private endPoints = new Map<Function, Map<string, IEndPointMetadata>>()
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
      controller: this.restControllers.get(endPoint.controllerConstructor)!,
    }))
  }
}
