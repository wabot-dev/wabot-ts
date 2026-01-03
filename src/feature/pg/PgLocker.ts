import { singleton } from '@/core/injection'
import { ILocker, ILockKey } from '@/core/lock'
import { Pool } from 'pg'
import { PgLockKey } from './PgLockKey'

@singleton()
export class PgLocker implements ILocker {
  constructor(private readonly pool: Pool) {}

  withKey(key: string | number): ILockKey {
    return new PgLockKey(key, this.pool)
  }
}
