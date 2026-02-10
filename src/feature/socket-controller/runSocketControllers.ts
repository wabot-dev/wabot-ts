import { CustomError } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container, DependencyContainer } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateAndTransform } from '@/core/validation'
import { Socket } from 'socket.io'
import { SocketServerProvider } from '../socket'
import { ISocketEventMetadata, SocketControllerMetadataStore } from './metadata'

export function runSocketControllers(controllers: IConstructor<any>[]) {
  const logger = new Logger('wabot:socket')
  const metadataStore = container.resolve(SocketControllerMetadataStore)
  const socketServerProvider = container.resolve(SocketServerProvider)
  const socketServer = socketServerProvider.getSocketServer()

  controllers.forEach((controller) => {
    const controllerInfo = metadataStore.getSocketControllerInfo(controller)

    const namespace = `/${controllerInfo.controller.config?.namespace ?? ''}`

    logger.info(`config connection to ${namespace}`)

    const namespaceServer = socketServer.of(namespace)

    namespaceServer.use(async (socket, next) => {
      const connectionContainer = container.createChildContainer()
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
        if (event.paramsTypes[0] !== Socket) {
          const reqType = event.paramsTypes[0]
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
          const keys = Object.keys(err).filter((key) => !['message', 'stack'].includes(key))
          const { httpCode, ...info } = keys.reduce(
            (acc, key) => {
              acc[key] = (err as any)[key]
              return acc
            },
            {} as { [key: string]: any },
          )
          if (typeof callback === 'function') {
            callback({ error: { ...info, message: err.message, stack: err.stack } })
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

        controllerInfo.events.forEach((event) => {
          logger.trace(`config listener to '${event.config.event}' event on '${namespace}'`)
          if (event.config.event === 'connection') {
            return
          }
          socket.on(event.config.event, async (req, callback) => {
            await eventListener(controllerInstance, socket, event, req, callback)
          })
        })

        const connectionEvent = controllerInfo.events.get('connection')
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
