import { IConstructor } from '@/core/generics'
import { singleton } from '@/core/injection'
import { IUiControllerMetadata } from './IUiControllerMetadata'
import { IViewMetadata } from './IViewMetadata'
import { IActionMetadata } from './IActionMetadata'
import { IUiMiddlewareMetadata } from './IUiMiddlewareMetadata'

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
export class UiControllerMetadataStore {
  private controllers = new Map<Function, IUiControllerMetadata>()
  private views = new Map<Function, Map<string, IViewMetadata>>()
  private actions = new Map<Function, Map<string, IActionMetadata>>()
  private middlewares = new Map<Function, Map<string, IUiMiddlewareMetadata[]>>()

  saveControllerMetadata(metadata: IUiControllerMetadata) {
    this.controllers.set(metadata.controllerConstructor, metadata)
  }

  saveViewMetadata(metadata: IViewMetadata) {
    let controllerViews = this.views.get(metadata.controllerConstructor)
    if (!controllerViews) {
      this.views.set(metadata.controllerConstructor, (controllerViews = new Map()))
    }
    controllerViews.set(metadata.functionName, metadata)
  }

  saveActionMetadata(metadata: IActionMetadata) {
    let controllerActions = this.actions.get(metadata.controllerConstructor)
    if (!controllerActions) {
      this.actions.set(metadata.controllerConstructor, (controllerActions = new Map()))
    }
    controllerActions.set(metadata.functionName, metadata)
  }

  saveMiddlewareMetadata(metadata: IUiMiddlewareMetadata) {
    let controllerMiddlewares = this.middlewares.get(metadata.controllerConstructor)
    if (!controllerMiddlewares) {
      this.middlewares.set(metadata.controllerConstructor, (controllerMiddlewares = new Map()))
    }
    let methodMiddlewares = controllerMiddlewares.get(metadata.functionName)
    if (!methodMiddlewares) {
      controllerMiddlewares.set(metadata.functionName, (methodMiddlewares = []))
    }
    methodMiddlewares.unshift(metadata)
  }

  getAllUiControllerConstructors(): IConstructor<any>[] {
    return Array.from(this.controllers.keys()) as IConstructor<any>[]
  }

  private getController(controllerConstructor: IConstructor<any>): IUiControllerMetadata {
    const controller = this.controllers.get(controllerConstructor)
    if (!controller) {
      throw new Error(`${controllerConstructor.name} should be decorated with @uiController`)
    }
    return controller
  }

  private collectMethodMiddlewares(
    hierarchy: Function[],
    functionName: string,
  ): IUiMiddlewareMetadata[] {
    const middlewares: IUiMiddlewareMetadata[] = []
    for (const cls of [...hierarchy].reverse()) {
      const classMiddlewares = this.middlewares.get(cls)?.get(functionName)
      if (classMiddlewares) {
        middlewares.push(...classMiddlewares)
      }
    }
    return middlewares
  }

  getControllerViewsInfo(controllerConstructor: IConstructor<any>) {
    const controller = this.getController(controllerConstructor)
    const hierarchy = [controllerConstructor, ...getClassHierarchy(controllerConstructor)]

    const viewsMap = new Map<string, IViewMetadata>()
    for (const cls of [...hierarchy].reverse()) {
      const classViews = this.views.get(cls)
      if (classViews) {
        for (const [name, view] of classViews) viewsMap.set(name, view)
      }
    }

    return [...viewsMap.values()].map((view) => ({
      ...view,
      controllerConstructor,
      controller,
      middlewares: this.collectMethodMiddlewares(hierarchy, view.functionName),
    }))
  }

  getControllerActionsInfo(controllerConstructor: IConstructor<any>) {
    const controller = this.getController(controllerConstructor)
    const hierarchy = [controllerConstructor, ...getClassHierarchy(controllerConstructor)]

    const actionsMap = new Map<string, IActionMetadata>()
    for (const cls of [...hierarchy].reverse()) {
      const classActions = this.actions.get(cls)
      if (classActions) {
        for (const [name, action] of classActions) actionsMap.set(name, action)
      }
    }

    return [...actionsMap.values()].map((action) => ({
      ...action,
      controllerConstructor,
      controller,
      middlewares: this.collectMethodMiddlewares(hierarchy, action.functionName),
    }))
  }
}
