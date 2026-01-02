import { ILockKey } from './ILockKey'

export interface ILocker {
  withKey(key: string | number): ILockKey
}

export class Locker implements ILocker {
  withKey(key: string | number): ILockKey {
    throw new Error('Not implemented')
  }
}
