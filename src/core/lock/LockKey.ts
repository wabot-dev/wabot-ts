import { createHash } from 'crypto'

type RawLockKey = number | string

export class LockKey {
  private static readonly registry = new Set<string>()
  private readonly id: string
  readonly value: bigint

  constructor(private readonly key: RawLockKey) {
    this.id = LockKey.toId(key)

    if (LockKey.registry.has(this.id)) {
      throw new Error(`LockKey already exists for key: ${String(key)}`)
    }

    LockKey.registry.add(this.id)

    this.value = typeof key === 'number' ? BigInt(key) : LockKey.hashString(key)
  }

  getRaw(): RawLockKey {
    return this.key
  }

  toString(): string {
    return `LockKey(${String(this.key)})`
  }

  private static toId(key: RawLockKey): string {
    return typeof key === 'number' ? `num:${key}` : `str:${key}`
  }

  private static hashString(key: string): bigint {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 16)
    return BigInt('0x' + hash)
  }
}
