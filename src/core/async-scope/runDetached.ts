/**
 * Clears one module's async-local state for the duration of `fn`, e.g. by
 * running it under that module's `AsyncLocalStorage` with an empty store.
 */
export type IDetachReset = <T>(fn: () => T) => T

const resets: IDetachReset[] = []

/**
 * Registers async-local state that work started through {@link runDetached}
 * must not inherit. Modules that keep per-scope resources in an
 * `AsyncLocalStorage` (a database connection, an open transaction) register
 * themselves on import.
 */
export function clearOnDetach(reset: IDetachReset): void {
  resets.push(reset)
}

/**
 * Runs `fn` as a unit of work of its own. Work started from inside a call
 * inherits its async-local state whether it is awaited or not, so
 * fire-and-forget work keeps using the caller's connection, joins its
 * transaction and keeps going after the caller is done with them. Entry points
 * that start such work (a job execution) go through here, so it starts with
 * every registered piece of that state cleared.
 */
export function runDetached<T>(fn: () => T): T {
  return resets.reduceRight<() => T>((next, reset) => () => reset(next), fn)()
}
