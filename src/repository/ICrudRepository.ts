export interface ICrudRepository<T> {
  find(id: string): Promise<T | null>
  findAll(id: string): Promise<T[]>
  create(item: T): Promise<void>
  update(item: T): Promise<void>
  discard(item: T): Promise<void>
}
