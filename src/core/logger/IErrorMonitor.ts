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
  /**
   * Optional: flush any buffered events to the backend. Called during crash
   * handling before the process exits, so a captured error is not lost to an
   * immediate `process.exit()` before the network send completes. The caller
   * bounds this with a timeout — implementations should resolve as soon as the
   * queue is drained.
   */
  flush?(): Promise<void>
}
