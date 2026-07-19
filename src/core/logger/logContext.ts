import { AsyncLocalStorage } from 'node:async_hooks'
import { Random } from '@/core/random'

export interface ILogContext {
  /** Correlation id for the current request / chat turn / job. */
  requestId?: string
  [key: string]: unknown
}

const storage = new AsyncLocalStorage<ILogContext>()

/** The log context active in the current async scope, if any. */
export function getLogContext(): ILogContext | undefined {
  return storage.getStore()
}

/**
 * Run `fn` inside a log context. Every `Logger` call within it (and any async
 * work it awaits) inherits the fields — `requestId`, plus whatever you pass
 * (chatId, channel, userId…) — so logs across channel → LLM → tools → DB share a
 * correlation id. A `requestId` is generated when not provided.
 */
export function runWithLogContext<T>(fields: ILogContext, fn: () => T): T {
  const context: ILogContext = { requestId: Random.alphaNumericLowerCase(12), ...fields }
  return storage.run(context, fn)
}

/**
 * Merge fields into the current context (e.g. add `chatId` once the chat is
 * resolved). No-op when called outside a `runWithLogContext` scope.
 */
export function addLogContext(fields: ILogContext): void {
  const context = storage.getStore()
  if (context) Object.assign(context, fields)
}
