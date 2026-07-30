import { ILockerKey } from '../lock'
import { Storable } from '../storable'

export interface IEntityData {
  id?: string
  createdAt?: number | null
}

export interface IEntityValidateOptions {
  /**
   * Require an id. A repository whose table assigns the id (`id: 'database'`)
   * validates with `false` on the way in: the value exists only once the INSERT
   * returns. Override `validate()` accordingly if your entity adds its own
   * checks and may be stored that way.
   */
  requireId?: boolean
}

export class Entity<D extends IEntityData> extends Storable<D> implements ILockerKey {
  get id() {
    if (!this.data.id) {
      throw new Error('id is required')
    }
    return this.data.id
  }

  /**
   * @deprecated use id
   */
  getId() {
    return this.id
  }

  get createdAt(): Date {
    if (!this.data.createdAt) {
      throw new Error('createdAt is required')
    }
    return new Date(this.data.createdAt)
  }

  /**
   * @deprecated use createdAt
   */
  getCreatedAt() {
    return this.createdAt
  }

  update(newData: Partial<Omit<D, 'id' | 'createdAt'>>) {
    const protectedFields = ['id', 'createdAt']
    const filteredData = Object.entries(newData).reduce((acc, [key, value]) => {
      if (value !== undefined && !protectedFields.includes(key)) {
        ;(acc as any)[key] = value
      }
      return acc
    }, {} as Partial<D>)
    this.data = { ...this.data, ...filteredData, updatedAt: new Date().getTime() }
  }

  wasCreated(): boolean {
    return !!this.data.createdAt || !!this.data.id
  }

  validate(options: IEntityValidateOptions = {}) {
    if (options.requireId !== false && !this.data.id) {
      throw new Error('id is required')
    }
    if (!this.data.createdAt) {
      throw new Error('createdAt is required')
    }
  }

  lockerKey(): string | number {
    return this.id
  }
}

/**
 * @deprecated Should use IEntityData
 */
export interface IPersistentData extends IEntityData {}

/**
 * @deprecated Should use Entity
 */
export class Persistent<D extends IPersistentData> extends Entity<D> {}
