import { singleton } from '@/core/injection'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'

/**
 * Shutdown runs in three ordered phases. Tasks within a phase run concurrently;
 * a phase completes before the next one starts.
 *
 * - **intake** — Stop accepting new work: disconnect channels, stop job/cron
 *   pollers. After this phase nothing new enters the system.
 * - **drain** — Wait for in-flight work to finish: running jobs, open HTTP
 *   requests. Bounded by the overall shutdown deadline.
 * - **close** — Release resources: socket server, database pool.
 */
export type ShutdownPhase = 'intake' | 'drain' | 'close'

const PHASE_ORDER: ShutdownPhase[] = ['intake', 'drain', 'close']

export interface IShutdownTask {
  /** Human-readable name, used in logs. */
  name: string
  phase: ShutdownPhase
  run: () => Promise<void> | void
}

const SIGNALS = ['SIGTERM', 'SIGINT'] as const

/**
 * Central graceful-shutdown orchestrator. Subsystems register tasks; the first
 * SIGTERM/SIGINT drains and releases them in order, a second signal forces an
 * immediate exit, and an overall deadline guarantees the process always exits.
 */
@singleton()
export class ShutdownManager {
  private tasks: IShutdownTask[] = []
  private shuttingDown = false
  private signalsInstalled = false
  private logger = new Logger('wabot:shutdown')
  /** Tasks started and not finished yet, so a timeout can name the culprit. */
  private pending = new Set<string>()

  constructor(private env: Env) {}

  /** Register a task to run during graceful shutdown. */
  register(task: IShutdownTask): void {
    this.tasks.push(task)
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown
  }

  /**
   * Trap SIGTERM/SIGINT once (idempotent). The first signal starts a graceful
   * shutdown and exits with its result code; a second signal while already
   * shutting down forces an immediate exit.
   */
  installSignalHandlers(): void {
    if (this.signalsInstalled) return
    this.signalsInstalled = true

    for (const signal of SIGNALS) {
      process.on(signal, () => {
        if (this.shuttingDown) {
          this.logger.warn(`Received ${signal} during shutdown — forcing exit`)
          process.exit(1)
        }
        this.logger.info(`Received ${signal} — starting graceful shutdown`)
        this.shutdown(signal).then(
          (code) => process.exit(code),
          (err) => {
            this.logger.fatal('Graceful shutdown crashed', err)
            process.exit(1)
          },
        )
      })
    }

    this.logger.info('Graceful shutdown handlers installed (SIGTERM, SIGINT)')
  }

  /**
   * Run every registered task, phase by phase. Never throws: a failing task is
   * logged and the remaining tasks still run. Bounded by
   * `WABOT_SHUTDOWN_TIMEOUT_SECONDS` (default 30); if the deadline passes it
   * resolves anyway so the caller can force the process to exit even when a
   * task is stuck. Returns the exit code the caller should use (0 clean, 1 on
   * timeout). Idempotent — a second call while shutting down resolves with 0.
   */
  async shutdown(reason: string): Promise<number> {
    if (this.shuttingDown) return 0
    this.shuttingDown = true

    // Production gets a real drain window; in dev nothing is worth waiting for
    // and a long deadline just reads as "Ctrl+C did nothing".
    const timeoutSeconds = this.env.requireNumber('WABOT_SHUTDOWN_TIMEOUT_SECONDS', {
      default: process.env.NODE_ENV === 'production' ? 30 : 3,
    })

    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutSeconds * 1000)
    })

    const outcome = await Promise.race([this.runPhases(), deadline])
    if (timer) clearTimeout(timer)

    if (outcome === 'timeout') {
      const stuck = this.pending.size ? [...this.pending].join(', ') : 'none reported'
      this.logger.error(
        `Graceful shutdown exceeded ${timeoutSeconds}s (reason: ${reason}) — ` +
          `still running: ${stuck}. Forcing exit`,
      )
      return 1
    }

    this.logger.info(`Graceful shutdown complete (reason: ${reason})`)
    return 0
  }

  private async runPhases(): Promise<'done'> {
    for (const phase of PHASE_ORDER) {
      const phaseTasks = this.tasks.filter((task) => task.phase === phase)
      if (phaseTasks.length === 0) continue

      this.logger.debug(`Shutdown phase "${phase}": ${phaseTasks.map((t) => t.name).join(', ')}`)
      await Promise.all(phaseTasks.map((task) => this.runTask(task)))
    }
    return 'done'
  }

  private async runTask(task: IShutdownTask): Promise<void> {
    this.pending.add(task.name)
    try {
      await task.run()
      this.logger.debug(`Shutdown task "${task.name}" done`)
    } catch (err) {
      this.logger.error(`Shutdown task "${task.name}" failed`, err)
    } finally {
      this.pending.delete(task.name)
    }
  }
}
