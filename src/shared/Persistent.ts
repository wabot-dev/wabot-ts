export interface IPersistent {
  id?: string
  createdAt?: number | null
  discardedAt?: number | null
}

export class Persistent<D extends IPersistent = IPersistent> {
  constructor(protected data: D) {}

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
    return new Date(this.data.createdAt)
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
    this.data.discardedAt = new Date().getTime()
  }
}
