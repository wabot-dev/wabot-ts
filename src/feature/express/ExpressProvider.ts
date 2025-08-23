import { HttpServerProvider } from '../http'
import express, { type Express } from 'express'
import { singleton } from 'tsyringe'
import bodyParser from 'body-parser'
import { Logger } from '@/core/logger'

@singleton()
export class ExpressProvider {
  private expressApp: Express | null = null
  private logger = new Logger('wabot:express')

  constructor(private httpServerProvider: HttpServerProvider) {}

  getExpress(): Express {
    if (!this.expressApp) {
      this.expressApp = this.createExpress()
    }
    return this.expressApp
  }

  listen(): void {
    this.httpServerProvider.listen()
  }

  private createExpress() {
    const expressApp = express()

    expressApp.use(bodyParser.json())

    expressApp.use((req, res, next) => {
      const start = process.hrtime()

      res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(start)
        const ms = (seconds * 1000 + nanoseconds / 1e6).toFixed(2)

        this.logger.trace(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`)
      })
      next()
    })

    const httpServer = this.httpServerProvider.getHttpServer()
    httpServer.on('request', expressApp)

    return expressApp
  }
}
