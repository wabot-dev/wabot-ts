import { ILockKey } from './ILockKey'

export interface ILockerKey {
  lockerKey(): string | number
}

export interface ILocker {
  withKey(key: string | number | ILockerKey): ILockKey
}

export class Locker implements ILocker {
  withKey(key: string | number | ILockerKey): ILockKey {
    throw new Error('Not implemented')
  }
}
