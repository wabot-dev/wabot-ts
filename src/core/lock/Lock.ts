import { LockKey } from './LockKey'

export class Lock {
  async withKey<T>(key: LockKey, fn: () => Promise<T>): Promise<T> {
    throw new Error('Not implemented')
  }

  async tryWithKey<T>(key: LockKey, fn: () => Promise<T>): Promise<T | undefined> {
    throw new Error('Not implemented')
  }
}
