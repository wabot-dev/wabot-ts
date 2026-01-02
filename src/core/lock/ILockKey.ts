export interface ILockKey {
  run<T>(fn: () => Promise<T>): Promise<T>
  tryRun<T>(fn: () => Promise<T>): Promise<T | undefined>
}
