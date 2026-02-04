export type ErrorSeverity = 'warning' | 'error' | 'fatal'

export interface IErrorMonitorContext {
  logger: string
  level: ErrorSeverity
  timestamp: Date
  extra?: Record<string, unknown>
}

export interface IErrorMonitor {
  captureError(error: Error, context: IErrorMonitorContext): void
  captureMessage(message: string, context: IErrorMonitorContext): void
}
