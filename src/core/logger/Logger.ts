import debug, { type Debugger } from 'debug'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const levelColors: Record<LogLevel, number> = {
  trace: 0,
  debug: 0,
  info: 0,
  warn: 5,
  error: 1,
  fatal: 1,
}

export class Logger {
  private debuggers: Record<LogLevel, Debugger>

  constructor(name: string) {
    this.debuggers = {} as Record<LogLevel, Debugger>

    for (const level of Object.keys(levelColors) as LogLevel[]) {
      const dbg = debug(`${name}:${level}`)
      dbg.color = '' + levelColors[level]
      this.debuggers[level] = dbg
    }
  }

  trace(...args: any[]) {
    this.log(this.debuggers['trace'], args)
  }

  debug(...args: any[]) {
    this.log(this.debuggers['debug'], args)
  }

  info(...args: any[]) {
    this.log(this.debuggers['info'], args)
  }

  warn(...args: any[]) {
    this.log(this.debuggers['warn'], args)
  }

  error(...args: any[]) {
    this.log(this.debuggers['error'], args)
  }

  fatal(...args: any[]) {
    this.log(this.debuggers['fatal'], args)
  }

  private log(debugg: Debugger, args: any[]) {
    const _args = args.map((arg) => {
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

    debugg(...(_args as [any, ...any[]]))
  }
}
