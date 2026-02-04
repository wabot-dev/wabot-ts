import { Logger } from '@/core/logger'

export interface IErrorHandlersConfig {
  exitOnUncaughtException?: boolean
  exitOnUnhandledRejection?: boolean
  logger?: Logger
}

const defaultConfig: Required<IErrorHandlersConfig> = {
  exitOnUncaughtException: true,
  exitOnUnhandledRejection: true,
  logger: new Logger('wabot:error'),
}

export function setupErrorHandlers(config?: IErrorHandlersConfig): void {
  const { exitOnUncaughtException, exitOnUnhandledRejection, logger } = {
    ...defaultConfig,
    ...config,
  }

  process.on('uncaughtException', (error: Error, origin: string) => {
    logger.fatal(`Uncaught Exception [${origin}]:`, error)
    if (exitOnUncaughtException) {
      process.exit(1)
    }
  })

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    if (reason instanceof Error) {
      logger.error('Unhandled Rejection:', reason)
    } else {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
    }
    if (exitOnUnhandledRejection) {
      process.exit(1)
    }
  })

  logger.info('Global error handlers configured')
}
