import { ISocketControllerMetadata } from './ISocketControllerMetadata'
import { IHandshakeMiddlewareMetadata } from './IHandshakeMiddlewareMetadata'
import { ISocketEventMetadata } from './ISocketEventMetadata'
import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'

@singleton()
export class SocketControllerMetadataStore {
  private socketControllers = new Map<Function, ISocketControllerMetadata>()
  private socketEvents = new Map<Function, Map<string, ISocketEventMetadata>>()
  private handshakeMiddlewares = new Map<Function, IHandshakeMiddlewareMetadata[]>()

  saveControllerMetadata(controllerMetadata: ISocketControllerMetadata) {
    this.socketControllers.set(controllerMetadata.controllerConstructor, controllerMetadata)
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

  saveHandshakeMiddlewareMetadata(handshakeMetadata: IHandshakeMiddlewareMetadata) {
    let controllerMiddlewares = this.handshakeMiddlewares.get(
      handshakeMetadata.controllerConstructor,
    )
    if (!controllerMiddlewares) {
      this.handshakeMiddlewares.set(
        handshakeMetadata.controllerConstructor,
        (controllerMiddlewares = []),
      )
    }
    controllerMiddlewares.unshift(handshakeMetadata)
  }

  getAllSocketControllerConstructors(): IConstructor<any>[] {
    return Array.from(this.socketControllers.keys()) as IConstructor<any>[]
  }

  getSocketControllerInfo(controllerConstructor: IConstructor<any>) {
    const controller = this.socketControllers.get(controllerConstructor)
    if (!controller) {
      throw new Error(`${controllerConstructor.name} should be decorated with @socketController`)
    }

    const handShakeMiddlewares = this.handshakeMiddlewares.get(controllerConstructor)
    const events =
      this.socketEvents.get(controllerConstructor) ?? new Map<string, ISocketEventMetadata>()

    return {
      controller,
      events,
      handShakeMiddlewares,
    }
  }
}
