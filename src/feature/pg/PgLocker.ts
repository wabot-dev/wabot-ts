import { singleton } from '@/core/injection'
import { ILocker, ILockerKey, ILockKey } from '@/core/lock'
import { Pool } from 'pg'
import { PgLockKey } from './PgLockKey'

@singleton()
export class PgLocker implements ILocker {
  constructor(private readonly pool: Pool) {}

  withKey(key: string | number | ILockerKey): ILockKey {
    return new PgLockKey(typeof key === 'object' ? key.lockerKey() : key, this.pool)
  }
}
