import { singleton } from '@/core/injection'
import { ILocker, ILockerKey } from '@/core/lock'
import { ILockKey } from '@/core/lock/ILockKey'
import { InMemoryLockKey } from './InMemoryLockKey'

@singleton()
export class InMemoryLocker implements ILocker {
  withKey(key: string | number | ILockerKey): ILockKey {
    const resolved = typeof key === 'object' ? key.lockerKey() : key
    return new InMemoryLockKey(resolved)
  }
}
