import { IConstructor } from '@/core/generics'
import { SocketControllerMetadataStore } from './metadata'
import path from 'path'
import { Logger } from '@/core/logger'
import { container, DependencyContainer } from '@/core/injection'
import { SocketServerProvider } from '../socket'
import { CustomError } from '@/core/error'
import { validate } from '@/core/validation'

export function runSocketControllers(controllers: IConstructor<any>[]) {
  const logger = new Logger('wabot:socket')
  const metadataStore = container.resolve(SocketControllerMetadataStore)
  const socketServerProvider = container.resolve(SocketServerProvider)
  const socketServer = socketServerProvider.getSocketServer()

  controllers.forEach((controller) => {
    const connections = metadataStore.getControllerSockerConnectionsInfo(controller)

    connections.forEach((connection) => {
      const namespace = path
        .join(connection.controller.config?.namespace ?? '/', connection.config?.namespace ?? '')
        .replaceAll('\\', '/')

      logger.info(`config connection to ${namespace}`)

      const namespaceServer = socketServer.of(namespace)

      namespaceServer.use(async (socket, next) => {
        const connectionContainer = container.createChildContainer()
        try {
          const middlewares = connection.connectionMiddlewares.map((x) =>
            connectionContainer.resolve(x.middlewareConstructor),
          )
          for (const middleware of middlewares) {
            await middleware.handle(socket, connectionContainer)
          }
          socket.data.connectionContainer = connectionContainer
          next()
        } catch (err) {
          next(err as any)
          connectionContainer.dispose()
        }
      })

      namespaceServer.on('connection', async (socket) => {
        logger.trace(`connection on '${namespace}'`)
        const connectionContainer = socket.data.connectionContainer as DependencyContainer

        try {
          const controllerInstance = connectionContainer.resolve(connection.controllerConstructor)

          connection.events.forEach((event) => {
            logger.trace(`config listener to '${event.config.event}' event on '${namespace}'`)
            socket.on(event.config.event, async (req, callback) => {
              logger.trace(`received '${event.config.event}' event on '${namespace}'`)

              try {
                const reqType = event.paramsTypes[0]
                if (typeof reqType !== 'function') {
                  throw new CustomError({
                    httpCode: 400,
                    message: 'Unable to validate request',
                  })
                }

                const { value, error } = validate(req, reqType)
                if (error) {
                  throw new CustomError({
                    httpCode: 400,
                    message: error.description,
                    info: error,
                  })
                }

                const out = await (controllerInstance[event.functionName] as Function).apply(
                  controllerInstance,
                  [value, socket],
                )
                callback(out)
              } catch (err) {
                logger.error(err)
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
            })
          })

          await (controllerInstance[connection.functionName] as Function).apply(
            controllerInstance,
            [socket],
          )
        } catch (err) {
          logger.error(err)
          socket.disconnect()
          connectionContainer.dispose()
        }
      })
    })
  })

  socketServerProvider.listen()
}
