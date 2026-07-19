import debug, { type Debugger } from 'debug'
import { errorToPlainObject } from '@/core/error/CustomError'
import type { ErrorSeverity, IErrorMonitor } from './IErrorMonitor'
import { getLogContext } from './logContext'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
type LogFormat = 'pretty' | 'json'

const levelColors: Record<LogLevel, number> = {
  trace: 0,
  debug: 0,
  info: 0,
  warn: 5,
  error: 1,
  fatal: 1,
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

const levelToSeverity: Partial<Record<LogLevel, ErrorSeverity>> = {
  warn: 'warning',
  error: 'error',
  fatal: 'fatal',
}

/**
 * Logger with 6 severity levels.
 *
 * **Format** is chosen automatically: human-readable (via the `debug` library)
 * when stdout is a TTY, structured JSON (one object per line to stdout) when it
 * is not — so dev looks familiar and prod is machine-parseable. Override with
 * `WABOT_LOG_FORMAT=pretty|json` or `Logger.configure({ format })`.
 *
 * **Filtering** in pretty mode is the usual `debug` namespaces
 * (`DEBUG=wabot:*:info,...`). In JSON mode you can additionally set a global
 * floor with `WABOT_LOG_LEVEL=info` to emit everything at that level or above
 * without listing namespaces.
 *
 * Every line carries the active {@link getLogContext} fields (requestId, chatId,
 * …) so logs across a request/turn correlate. `warn`/`error`/`fatal` also go to
 * the optional {@link IErrorMonitor}, independent of the console filter.
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
  private static formatOverride: LogFormat | null = null
  private static levelFloorOverride: LogLevel | null | undefined = undefined
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

  /**
   * Programmatically override the output format and/or the JSON level floor.
   * Pass `null` to clear an override and fall back to env / auto-detection.
   */
  static configure(options: { format?: LogFormat | null; level?: LogLevel | null }): void {
    if (options.format !== undefined) Logger.formatOverride = options.format
    if (options.level !== undefined) Logger.levelFloorOverride = options.level
  }

  private static resolveFormat(): LogFormat {
    if (Logger.formatOverride) return Logger.formatOverride
    const env = process.env.WABOT_LOG_FORMAT
    if (env === 'json' || env === 'pretty') return env
    return process.stdout?.isTTY ? 'pretty' : 'json'
  }

  private static resolveLevelFloor(): LogLevel | null {
    if (Logger.levelFloorOverride !== undefined) return Logger.levelFloorOverride
    const env = process.env.WABOT_LOG_LEVEL
    return env && env in LEVEL_ORDER ? (env as LogLevel) : null
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
    if (Logger.resolveFormat() === 'json') {
      if (this.jsonEnabled(level)) {
        process.stdout.write(JSON.stringify(this.buildRecord(level, args)) + '\n')
      }
    } else {
      // Pretty: unchanged `debug` output (it self-gates on DEBUG), with the
      // correlation context appended as a compact suffix.
      const debugg = this.debuggers[level]
      if (debugg.enabled) {
        const formattedArgs = this.formatArgs(args)
        const suffix = this.contextSuffix()
        const line = suffix ? [...formattedArgs, suffix] : formattedArgs
        debugg(...(line as [any, ...any[]]))
      }
    }

    this.sendToMonitor(level, args)
  }

  /** In JSON mode, emit when the namespace is DEBUG-enabled or meets the WABOT_LOG_LEVEL floor. */
  private jsonEnabled(level: LogLevel): boolean {
    if (this.debuggers[level].enabled) return true
    const floor = Logger.resolveLevelFloor()
    return floor !== null && LEVEL_ORDER[level] >= LEVEL_ORDER[floor]
  }

  private buildRecord(level: LogLevel, args: any[]): Record<string, unknown> {
    const error = args.find((arg) => arg instanceof Error) as Error | undefined
    // String args form the human message; objects/primitives become structured
    // fields (via extractExtra) and the Error becomes `err`.
    const message = args.filter((arg) => typeof arg === 'string').join(' ')

    return {
      ...getLogContext(),
      ...this.extractExtra(args),
      ...(error ? { err: errorToPlainObject(error) } : {}),
      time: new Date().toISOString(),
      level,
      logger: this.name,
      message,
    }
  }

  private contextSuffix(): string {
    const context = getLogContext()
    if (!context) return ''
    const parts = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object')
      .map(([key, value]) => `${key}=${value}`)
    return parts.length > 0 ? `[${parts.join(' ')}]` : ''
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
        return JSON.stringify(errorToPlainObject(arg))
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
