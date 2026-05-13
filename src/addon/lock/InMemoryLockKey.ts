import { ILockKey } from '@/core/lock/ILockKey'

export class InMemoryLockKey implements ILockKey {
  private static locks = new Map<string | number, Promise<void>>()

  constructor(private readonly key: string | number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const lock = new Promise<void>((r) => {
      release = r
    })

    const prev = InMemoryLockKey.locks.get(this.key) ?? Promise.resolve()
    InMemoryLockKey.locks.set(this.key, lock)

    try {
      await prev
      return await fn()
    } finally {
      if (InMemoryLockKey.locks.get(this.key) === lock) {
        InMemoryLockKey.locks.delete(this.key)
      }
      release!()
    }
  }

  async tryRun<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (InMemoryLockKey.locks.has(this.key)) return undefined

    let release: () => void
    const lock = new Promise<void>((r) => {
      release = r
    })
    InMemoryLockKey.locks.set(this.key, lock)

    try {
      return await fn()
    } finally {
      if (InMemoryLockKey.locks.get(this.key) === lock) {
        InMemoryLockKey.locks.delete(this.key)
      }
      release!()
    }
  }
}
