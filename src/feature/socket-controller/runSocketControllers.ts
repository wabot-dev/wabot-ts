import { CustomError, errorToPlainObject } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateAndTransform } from '@/core/validation'
import { Socket } from 'socket.io'
import { SocketServerProvider } from '../socket'
import { ISocketEventMetadata, SocketControllerMetadataStore } from './metadata'

export interface IRunSocketControllersOptions {
  /** Container used to resolve controllers and create per-connection scopes. */
  baseContainer?: DependencyContainer
  /** Socket.IO server provider to use (defaults to the resolved singleton). */
  socketServerProvider?: SocketServerProvider
}

export function runSocketControllers(
  controllers: IConstructor<any>[],
  options: IRunSocketControllersOptions = {},
) {
  const baseContainer = options.baseContainer ?? container
  const logger = new Logger('wabot:socket')
  const metadataStore = baseContainer.resolve(SocketControllerMetadataStore)
  const socketServerProvider =
    options.socketServerProvider ?? baseContainer.resolve(SocketServerProvider)
  const socketServer = socketServerProvider.getSocketServer()

  controllers.forEach((controller) => {
    const controllerInfo = metadataStore.getSocketControllerInfo(controller)

    const namespace = `/${controllerInfo.controller.config?.namespace ?? ''}`

    logger.info(`config connection to ${namespace}`)

    const namespaceServer = socketServer.of(namespace)

    namespaceServer.use(async (socket, next) => {
      const connectionContainer = baseContainer.createChildContainer()
      connectionContainer.register(Container, { useValue: connectionContainer })
      try {
        const middlewares =
          controllerInfo.handShakeMiddlewares?.map((x) =>
            connectionContainer.resolve(x.middlewareConstructor),
          ) ?? []
        for (const middleware of middlewares) {
          await middleware.handle(socket, connectionContainer)
        }
        socket.data.connectionContainer = connectionContainer
        connectionContainer.registerInstance(Socket, socket)
        next()
      } catch (err) {
        next(err as any)
        connectionContainer.dispose()
      }
    })

    const eventListener = async (
      controllerInstance: any,
      socket: Socket,
      event: ISocketEventMetadata,
      req: any,
      callback: any,
    ) => {
      logger.trace(`received '${event.config.event}' event on '${namespace}'`)

      const paramsValues: any[] = []

      try {
        if (event.paramsTypes.length > 2) {
          throw new CustomError({
            httpCode: 400,
            message: 'the socket event handler should have max 2 parameters: (req, socket)',
          })
        }
        // Detect the injected Socket param by identity OR class name: a consumer
        // may resolve a different `socket.io` copy (duplicate install / peer dep),
        // so its `Socket` class is not `===` ours even though it is a socket.
        const firstType = event.paramsTypes[0]
        const firstIsSocket = firstType === Socket || firstType?.name === 'Socket'
        if (!firstIsSocket) {
          const reqType = firstType
          if (typeof reqType !== 'function') {
            throw new CustomError({
              httpCode: 400,
              message: 'Unable to validate request',
            })
          }

          const { value, error } = validateAndTransform(req, reqType)
          if (error) {
            throw new CustomError({
              httpCode: 400,
              message: error.description,
              info: error,
            })
          }
          paramsValues.push(value)
        }

        paramsValues.push(socket)

        const out = await (controllerInstance[event.functionName] as Function).apply(
          controllerInstance,
          paramsValues,
        )
        if (typeof callback === 'function') {
          callback(out)
        }
      } catch (err) {
        logger.error(`Event '${event.config.event}' on '${namespace}' failed`, err)
        if (err instanceof Error) {
          const { name: _name, httpCode: _httpCode, ...info } = errorToPlainObject(err)
          if (typeof callback === 'function') {
            callback({ error: info })
          }
        } else {
          if (typeof callback === 'function') {
            callback({ error: { message: 'Unspected error' } })
          }
        }
      }
    }

    namespaceServer.on('connection', async (socket) => {
      logger.trace(`connection on '${namespace}'`)
      const connectionContainer = socket.data.connectionContainer as DependencyContainer

      try {
        const controllerInstance = connectionContainer.resolve(
          controllerInfo.controller.controllerConstructor,
        )

        // The events map is keyed by method name, so look the connection
        // handler up by its configured event name (not `events.get('connection')`,
        // which only matched when the method itself was named `connection`).
        let connectionEvent: ISocketEventMetadata | undefined
        controllerInfo.events.forEach((event) => {
          logger.trace(`config listener to '${event.config.event}' event on '${namespace}'`)
          if (event.config.event === 'connection') {
            connectionEvent = event
            return
          }
          socket.on(event.config.event, async (req, callback) => {
            await eventListener(controllerInstance, socket, event, req, callback)
          })
        })

        if (connectionEvent) {
          await eventListener(controllerInstance, socket, connectionEvent, null, null)
        }
      } catch (err) {
        logger.error(`Connection setup on '${namespace}' failed`, err)
        socket.disconnect()
        connectionContainer.dispose()
      }
    })
  })

  socketServerProvider.listen()
}
