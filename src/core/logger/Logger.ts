import debug, { type Debugger } from 'debug'
import type { ErrorSeverity, IErrorMonitor } from './IErrorMonitor'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const levelColors: Record<LogLevel, number> = {
  trace: 0,
  debug: 0,
  info: 0,
  warn: 5,
  error: 1,
  fatal: 1,
}

const levelToSeverity: Partial<Record<LogLevel, ErrorSeverity>> = {
  warn: 'warning',
  error: 'error',
  fatal: 'fatal',
}

/**
 * Logger with 6 severity levels. Uses the `debug` library for output.
 *
 * ## Level verbosity contract
 *
 * - **fatal** — The process cannot continue. Something is critically broken
 *   (uncaught exceptions, unhandled rejections). Investigate immediately.
 *
 * - **error** — An operation failed unexpectedly. Always include: what failed,
 *   why (the Error), and enough context to locate the problem (IDs, names).
 *
 * - **warn** — Something unusual happened but the system handled it gracefully.
 *   Known limitations, safety guards triggered, recoverable issues.
 *
 * - **info** — Key lifecycle events the user cares about: systems starting or
 *   stopping, configuration applied, significant state changes. Should read
 *   like a high-level audit log.
 *
 * - **debug** — Internal operational details for developers troubleshooting.
 *   Step-by-step flow, lock acquisition, query execution, reconciliation steps.
 *
 * - **trace** — Very fine-grained: every HTTP request, every socket event,
 *   every message sent or received.
 */
export class Logger {
  private static monitor: IErrorMonitor | null = null
  private debuggers: Record<LogLevel, Debugger>
  private name: string

  constructor(name: string) {
    this.name = name
    this.debuggers = {} as Record<LogLevel, Debugger>

    for (const level of Object.keys(levelColors) as LogLevel[]) {
      const dbg = debug(`${name}:${level}`)
      dbg.color = '' + levelColors[level]
      this.debuggers[level] = dbg
    }
  }

  static setMonitor(monitor: IErrorMonitor): void {
    Logger.monitor = monitor
  }

  static getMonitor(): IErrorMonitor | null {
    return Logger.monitor
  }

  /** Very fine-grained: every HTTP request, socket event, message sent/received. */
  trace(...args: any[]) {
    this.log('trace', args)
  }

  /** Internal operational details for developers: step-by-step flow, lock acquisition, queries. */
  debug(...args: any[]) {
    this.log('debug', args)
  }

  /** Key lifecycle events: systems start/stop, configuration applied, significant state changes. */
  info(...args: any[]) {
    this.log('info', args)
  }

  /** Something unusual happened but the system recovered. Known limitations, safety guards. */
  warn(...args: any[]) {
    this.log('warn', args)
  }

  /** Operation failed unexpectedly. Always include: what failed + why (Error) + identifiers. */
  error(...args: any[]) {
    this.log('error', args)
  }

  /** Process cannot continue. Uncaught exceptions, unhandled rejections. Investigate immediately. */
  fatal(...args: any[]) {
    this.log('fatal', args)
  }

  private log(level: LogLevel, args: any[]) {
    const debugg = this.debuggers[level]
    const formattedArgs = this.formatArgs(args)
    debugg(...(formattedArgs as [any, ...any[]]))

    this.sendToMonitor(level, args)
  }

  private sendToMonitor(level: LogLevel, args: any[]) {
    const severity = levelToSeverity[level]
    if (!severity || !Logger.monitor) return

    const context = {
      logger: this.name,
      level: severity,
      timestamp: new Date(),
      extra: this.extractExtra(args),
    }

    const error = args.find((arg) => arg instanceof Error) as Error | undefined

    if (error) {
      Logger.monitor.captureError(error, context)
    } else {
      const message = args
        .filter((arg) => !(arg instanceof Error))
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ')
      Logger.monitor.captureMessage(message, context)
    }
  }

  private extractExtra(args: any[]): Record<string, unknown> {
    const extra: Record<string, unknown> = {}
    let index = 0

    for (const arg of args) {
      if (arg instanceof Error) continue
      if (typeof arg === 'object' && arg !== null) {
        Object.assign(extra, arg)
      } else if (typeof arg !== 'string') {
        extra[`arg${index}`] = arg
      }
      index++
    }

    return Object.keys(extra).length > 0 ? extra : {}
  }

  private formatArgs(args: any[]): any[] {
    return args.map((arg) => {
      if (arg instanceof Error) {
        return JSON.stringify({
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
        })
      }

      if (arg === null) {
        return 'null'
      }

      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg)
        } catch (e) {
          return '[Circular]'
        }
      }

      return arg
    })
  }
}
