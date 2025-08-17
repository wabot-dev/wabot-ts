import { IStorableData, Storable } from './Storable'

export interface IEntityData extends IStorableData {
  id?: string
  createdAt?: number | null
  discardedAt?: number | null
}

export class Entity<D extends IEntityData> extends Storable<D> {
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

  update(newData: Omit<D, 'id' | 'createdAt' | 'discardedAt'>) {
    this.data = { ...this.data, newData, updatedAt: new Date().getTime() }
  }

  wasCreated(): boolean {
    return !!this.data.createdAt || !!this.data.id
  }

  validate() {
    if (!this.data.id) {
      throw new Error('id is required')
    }
    if (!this.data.createdAt) {
      throw new Error('createdAt is required')
    }
  }

  discard() {
    this.data.discardedAt = new Date().getTime()
  }
}

/**
 * @deprecated Should use IEntityData
 */
export interface IPersistentData extends IEntityData {}

/**
 * @deprecated Should use Entity
 */
export class PersistentData<D extends IPersistentData> extends Entity<D> {}
