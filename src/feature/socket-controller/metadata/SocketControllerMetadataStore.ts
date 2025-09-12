import { ISocketControllerMetadata } from './ISocketControllerMetadata'
import { ISocketConnectionMetadata } from './ISocketConnectionMetadata'
import { IConnectionMiddlewareMetadata } from './IConnectionMiddlewareMetadata'
import { ISocketEventMetadata } from './ISocketEventMetadata'
import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'

@singleton()
export class SocketControllerMetadataStore {
  private socketControllers = new Map<Function, ISocketControllerMetadata>()
  private socketConnections = new Map<Function, Map<string, ISocketConnectionMetadata>>()
  private socketEvents = new Map<Function, Map<string, ISocketEventMetadata>>()
  private connectionMiddlewares = new Map<Function, Map<string, IConnectionMiddlewareMetadata[]>>()

  saveControllerMetadata(controllerMetadata: ISocketControllerMetadata) {
    this.socketControllers.set(controllerMetadata.controllerConstructor, controllerMetadata)
  }

  saveSocketConnectionMetadata(socketConnectionMetadata: ISocketConnectionMetadata) {
    let controllerConnections = this.socketConnections.get(
      socketConnectionMetadata.controllerConstructor,
    )
    if (!controllerConnections) {
      this.socketConnections.set(
        socketConnectionMetadata.controllerConstructor,
        (controllerConnections = new Map()),
      )
    }
    controllerConnections.set(socketConnectionMetadata.functionName, socketConnectionMetadata)
  }

  saveSocketEventMetadata(socketEventMetadata: ISocketEventMetadata) {
    let controllerEvents = this.socketEvents.get(socketEventMetadata.controllerConstructor)
    if (!controllerEvents) {
      this.socketEvents.set(
        socketEventMetadata.controllerConstructor,
        (controllerEvents = new Map()),
      )
    }
    controllerEvents.set(socketEventMetadata.functionName, socketEventMetadata)
  }

  saveConnectionMiddlewareMetadata(middlewareMetadata: IConnectionMiddlewareMetadata) {
    let controllerMiddlewares = this.connectionMiddlewares.get(
      middlewareMetadata.controllerConstructor,
    )
    if (!controllerMiddlewares) {
      this.connectionMiddlewares.set(
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

  getControllerSockerConnectionsInfo(controllerConstructor: IConstructor<any>) {
    const controller = this.socketControllers.get(controllerConstructor)
    if (!controller) {
      throw new Error(`${controllerConstructor.name} should be decorated with @socketController`)
    }

    const connections = this.socketConnections.get(controllerConstructor)
    const events =
      this.socketEvents.get(controllerConstructor) ?? new Map<string, ISocketEventMetadata>()

    if (!connections?.size) {
      // TODO: Warning
      return []
    }

    return [...connections.values()].map((connection) => ({
      ...connection,
      events: (() => {
        const connectionNamespace = connection.config?.namespace
        return [...events.values()].filter((x) => x.config?.namespace === connectionNamespace)
      })(),
      connectionMiddlewares:
        this.connectionMiddlewares
          .get(connection.controllerConstructor)
          ?.get(connection.functionName) ?? [],
      controller: this.socketControllers.get(connection.controllerConstructor)!,
    }))
  }
}
