import { Logger } from '@/core/logger'

/**
 * Crash handling is deliberately separate from graceful shutdown (see
 * {@link ShutdownManager}). A SIGTERM/SIGINT means "wind down cleanly" — drain
 * in-flight work, then exit. An `uncaughtException` or `unhandledRejection`
 * means the process is in an undefined state: Node's docs are explicit that it
 * is not safe to resume normal operation, so we do NOT drain. Instead we log
 * (which reports to the error monitor), give the monitor a short bounded window
 * to flush, and exit non-zero so the orchestrator restarts a clean process.
 */
export interface ICrashHandlersConfig {
  /** Exit on uncaughtException. Default true (matches Node's default outcome). */
  exitOnUncaughtException?: boolean
  /** Exit on unhandledRejection. Default true (matches Node 15+ default). */
  exitOnUnhandledRejection?: boolean
  /** Max time to wait for the error monitor to flush before exiting. Default 2000ms. */
  flushTimeoutMs?: number
  logger?: Logger
  /** Injectable exit function; defaults to process.exit. Used by tests. */
  exit?: (code: number) => void
}

const DEFAULT_FLUSH_TIMEOUT_MS = 2000

let installed = false

/**
 * Best-effort flush of the error monitor, bounded by `timeoutMs`. Never throws
 * and never hangs: a slow or failing flush must not block a crashing process
 * from exiting.
 */
export async function flushErrorMonitor(timeoutMs: number): Promise<void> {
  const monitor = Logger.getMonitor()
  if (!monitor?.flush) return
  try {
    await Promise.race([
      Promise.resolve(monitor.flush()),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  } catch {
    // best-effort — swallow flush errors during a crash
  }
}

/**
 * Handle a fatal error: log it (which captures to the monitor), then — if we
 * should exit — flush the monitor within the budget and exit with code 1.
 * Pure and side-effect-injectable so it can be unit-tested without touching the
 * real process.
 */
export async function handleFatal(
  error: unknown,
  opts: {
    label: string
    logger: Logger
    exit: (code: number) => void
    flushTimeoutMs: number
    shouldExit: boolean
  },
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error))
  opts.logger.fatal(`${opts.label}:`, err)

  if (!opts.shouldExit) return

  await flushErrorMonitor(opts.flushTimeoutMs)
  opts.exit(1)
}

/**
 * Install process-level crash handlers (uncaughtException, unhandledRejection).
 * Idempotent. Complements {@link ShutdownManager}, which owns SIGTERM/SIGINT —
 * there is no signal overlap between the two.
 */
export function setupCrashHandlers(config?: ICrashHandlersConfig): void {
  if (installed) return
  installed = true

  const logger = config?.logger ?? new Logger('wabot:crash')
  const exit = config?.exit ?? ((code: number) => process.exit(code))
  const flushTimeoutMs = config?.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS
  const exitOnUncaughtException = config?.exitOnUncaughtException ?? true
  const exitOnUnhandledRejection = config?.exitOnUnhandledRejection ?? true

  // Re-entrancy guard: once a fatal error is being handled we ignore further
  // ones so the exit-in-progress is not interrupted or looped.
  let handling = false
  const onFatal = (error: unknown, label: string, shouldExit: boolean) => {
    if (handling) return
    handling = true
    handleFatal(error, { label, logger, exit, flushTimeoutMs, shouldExit }).finally(() => {
      // Keep the guard latched while exiting; reset it if we chose to survive
      // so later errors are still logged.
      if (!shouldExit) handling = false
    })
  }

  process.on('uncaughtException', (error: Error, origin: string) => {
    onFatal(error, `Uncaught Exception [${origin}]`, exitOnUncaughtException)
  })

  process.on('unhandledRejection', (reason: unknown) => {
    onFatal(reason, 'Unhandled Rejection', exitOnUnhandledRejection)
  })

  logger.info('Crash handlers installed (uncaughtException, unhandledRejection)')
}
