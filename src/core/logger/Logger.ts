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

  trace(...args: any[]) {
    this.log('trace', args)
  }

  debug(...args: any[]) {
    this.log('debug', args)
  }

  info(...args: any[]) {
    this.log('info', args)
  }

  warn(...args: any[]) {
    this.log('warn', args)
  }

  error(...args: any[]) {
    this.log('error', args)
  }

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
