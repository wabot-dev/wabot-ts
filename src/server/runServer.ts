import { ControllerMetadataStore, ExpressApp, SocketIoApp } from '@/controller'
import { type IConstructor, type IMessageContext } from '@/core'
import { container } from '@/injection'
import { prepareChatContainer } from './prepareChatContainer'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import http from 'http'
import bodyParser from 'body-parser'
import { Logger } from '@/logger'

export interface IServerProvider<T, ST extends T> {
  replace: IConstructor<T>
  with: IConstructor<ST>
  singleton?: true
}

export interface IServerConfig {
  controllers: IConstructor<any>[]
  providers?: IServerProvider<unknown, unknown>[]
}

export function runServer(config: IServerConfig) {
  const httpLogger = new Logger('wabot:http')
  const socketLogger = new Logger('wabot:socket')

  const expressApp = express()
  const httpServer = http.createServer(expressApp)
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
    },
  })

  expressApp.use(bodyParser.json())

  expressApp.use((req, res, next) => {
    const start = process.hrtime()

    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start)
      const ms = (seconds * 1000 + nanoseconds / 1e6).toFixed(2)

      httpLogger.trace(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`)
    })
    next()
  })

  io.on('connection', (socket) => {
    socketLogger.trace(`socket:${socket.id} connection`)

    socket.onAny((event) => {
      socketLogger.trace(`socket:${socket.id} emmits ${event}`)
    })

    socket.on('disconnect', (reason) => {
      socketLogger.trace(`socket:${socket.id} disconnect with reason: ${reason}`)
    })
  })

  container.register(ExpressApp, { useValue: expressApp })
  container.register(SocketIoApp, { useValue: io })

  for (const provider of config.providers ?? []) {
    if (provider.singleton) {
      container.registerSingleton(provider.replace, provider.with)
    } else {
      container.register(provider.replace, provider.with)
    }
  }

  const metadataStore = container.resolve(ControllerMetadataStore)
  for (const controllerCtor of config.controllers) {
    const chatControllerMetadata = metadataStore.getChatControllerMetadata(controllerCtor)
    if (!chatControllerMetadata) {
      continue
    }
    for (const channelMetadata of chatControllerMetadata.channels) {
      const channelContainer = container.createChildContainer()
      if (channelMetadata.channelConfig) {
        channelContainer.register(channelMetadata.channelConfig.constructor as any, {
          useValue: channelMetadata.channelConfig,
        })
      }
      const channel = channelContainer.resolve(channelMetadata.channelConstructor)
      channel.listen(async (messageContext: IMessageContext) => {
        const chatContainer = await prepareChatContainer(channelContainer, messageContext)
        const chatController = chatContainer.resolve(channelMetadata.controllerConstructor)
        chatController[channelMetadata.functionName](messageContext)
      })

      channel.connect()
    }
  }

  const PORT = process.env.PORT || 3000
  httpServer.listen(PORT, () => {
    httpLogger.info(`server listenig on port ${PORT}`)
  })
}
