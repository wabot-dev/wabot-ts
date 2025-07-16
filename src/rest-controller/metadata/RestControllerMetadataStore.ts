import { singleton } from 'tsyringe'
import { IEndPointMetadata } from './IEndPointMetadata'
import { IRestControllerMetadata } from './IRestControllerMetadata'

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
}
