import { createHash } from 'crypto'

type RawLockKey = number | string

export class LockKey {
  readonly value: bigint

  constructor(private readonly key: RawLockKey) {
    this.value = typeof key === 'number' ? BigInt(key) : LockKey.hashString(key)
  }

  getRaw(): RawLockKey {
    return this.key
  }

  toString(): string {
    return `LockKey(${String(this.key)})`
  }

  private static hashString(key: string): bigint {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 12)
    return BigInt('0x' + hash)
  }
}
