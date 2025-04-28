export interface IPersistent {
  id?: string
  createdAt?: Date | null
  discardedAt?: Date | null
}

export class Persistent<D extends IPersistent> {
  private originalData: D

  constructor(protected data: D) {
    this.originalData = { ...data }
  }

  getId(): string {
    if (!this.data.id) {
      throw new Error('id is required')
    }
    return this.data.id
  }

  getCreatedAt(): Date {
    if (!this.data.createdAt) {
      throw new Error('createdAt is required')
    }
    return this.data.createdAt
  }

  update(newData: D) {
    this.data = newData
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
    this.data.discardedAt = new Date()
  }
}
