import { IEndPointMetadata } from './IEndPointMetadata'
import { IRestControllerMetadata } from './IRestControllerMetadata'
import { IConstructor } from '@/core/generics'
import { IMiddlewareMetadata } from './IMiddlewareMetadata'
import { singleton } from '@/core/injection'

function getClassHierarchy(cls: Function): Function[] {
  const classes: Function[] = []
  let proto = Object.getPrototypeOf(cls.prototype)

  while (proto && proto.constructor !== Object) {
    classes.push(proto.constructor)
    proto = Object.getPrototypeOf(proto)
  }

  return classes
}

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

    const hierarchy = [controllerConstructor, ...getClassHierarchy(controllerConstructor)]
    const endPointsMap = new Map<string, IEndPointMetadata>()

    for (const cls of [...hierarchy].reverse()) {
      const classEndPoints = this.endPoints.get(cls)
      if (classEndPoints) {
        for (const [name, endPoint] of classEndPoints) {
          endPointsMap.set(name, endPoint)
        }
      }
    }

    if (!endPointsMap.size) {
      return []
    }

    return [...endPointsMap.values()].map((endPoint) => {
      const middlewares: IMiddlewareMetadata[] = []
      for (const cls of [...hierarchy].reverse()) {
        const classMiddlewares = this.middlewares.get(cls)?.get(endPoint.functionName)
        if (classMiddlewares) {
          middlewares.push(...classMiddlewares)
        }
      }

      return {
        ...endPoint,
        controllerConstructor,
        middlewares,
        controller,
      }
    })
  }
}
