import { Logger } from '@/core/logger'
import { setupCrashHandlers } from '@/core/lifecycle/setupCrashHandlers'

export interface IErrorHandlersConfig {
  exitOnUncaughtException?: boolean
  exitOnUnhandledRejection?: boolean
  logger?: Logger
}

/**
 * @deprecated Use `setupCrashHandlers` from `@/core/lifecycle`. Kept as a thin
 * back-compat wrapper. The framework now installs crash handlers automatically
 * at startup (see ProjectRunner), so calling this manually is no longer needed.
 */
export function setupErrorHandlers(config?: IErrorHandlersConfig): void {
  setupCrashHandlers(config)
}
